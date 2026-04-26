import { store, isValidTurn, advanceTurn, updateUserScore, saveSnapshot } from '../store/memory.js';
import { getAIResponse, generateDebateSummary } from '../ai/claudeOpponent.js';

const TEXT_LIMIT = 5;
const VOICE_LIMIT = 5;

export function registerDebate(io) {
  io.on('connection', (socket) => {

    socket.on('SEND_TEXT_MESSAGE', async ({ debateId, content }) => {
      const debate = store.debates.get(debateId);
      if (!debate || debate.phase !== 'text') return;
      if (!isValidTurn(debate, socket.id, store)) return;
      if (!content?.trim()) return;

      const user = store.users.get(socket.id);
      const side = user.side;
      const msg = { side, content: content.trim(), timestamp: Date.now() };

      debate.textMessages.push(msg);
      debate.textCount[side]++;
      advanceTurn(debate);

      io.to(debateId).emit('TEXT_MESSAGE_RECEIVED', msg);
      io.to(debateId).emit('TURN_CHANGED', { turn: debate.turn });

      if (debate.textCount.believer >= TEXT_LIMIT && debate.textCount.atheist >= TEXT_LIMIT) {
        await transitionToVoice(io, debate);
        return;
      }

      if (debate.isAI && !debate.isAITurn) {
        await handleAITextTurn(io, debate);
      }
    });

    socket.on('SEND_VOICE_MESSAGE', async ({ debateId, audioB64, duration }) => {
      const debate = store.debates.get(debateId);
      if (!debate || debate.phase !== 'voice') return;
      if (!isValidTurn(debate, socket.id, store)) return;

      const user = store.users.get(socket.id);
      const side = user.side;
      const msg = { side, audioB64, duration: duration || 0, timestamp: Date.now() };

      debate.voiceMessages.push(msg);
      debate.voiceCount[side]++;
      advanceTurn(debate);

      io.to(debateId).emit('VOICE_MESSAGE_RECEIVED', msg);
      io.to(debateId).emit('TURN_CHANGED', { turn: debate.turn });

      if (debate.voiceCount.believer >= VOICE_LIMIT && debate.voiceCount.atheist >= VOICE_LIMIT) {
        await transitionToLive(io, debate);
        return;
      }

      if (debate.isAI && !debate.isAITurn) {
        await handleAIVoiceTurn(io, debate);
      }
    });

    socket.on('VOICE_RECORDING_START', ({ debateId }) => {
      socket.to(debateId).emit('OPPONENT_RECORDING');
    });

    socket.on('VOICE_RECORDING_STOP', ({ debateId }) => {
      socket.to(debateId).emit('OPPONENT_STOPPED');
    });

    socket.on('END_DEBATE', async ({ debateId }) => {
      const debate = store.debates.get(debateId);
      if (!debate) return;
      await finishDebate(io, debate);
    });

    socket.on('disconnect', () => {
      for (const [debateId, debate] of store.debates.entries()) {
        if (debate.phase === 'finished') continue;
        const isBelieverd = debate.believer.socketId === socket.id;
        const isAtheist   = debate.atheist.socketId === socket.id;
        if (isBelieverd || isAtheist) {
          socket.to(debateId).emit('OPPONENT_DISCONNECTED');
        }
      }
    });
  });
}

async function handleAITextTurn(io, debate) {
  debate.isAITurn = true;
  io.to(debate.id).emit('AI_TYPING');
  await new Promise(r => setTimeout(r, 1500));
  try {
    const text = await getAIResponse({
      side: debate.aiSide,
      history: debate.textMessages,
      phase: 'text',
    });
    const msg = { side: debate.aiSide, content: text, timestamp: Date.now(), isAI: true };
    debate.textMessages.push(msg);
    debate.textCount[debate.aiSide]++;
    advanceTurn(debate);
    debate.isAITurn = false;

    io.to(debate.id).emit('TEXT_MESSAGE_RECEIVED', msg);
    io.to(debate.id).emit('TURN_CHANGED', { turn: debate.turn });

    if (debate.textCount.believer >= TEXT_LIMIT && debate.textCount.atheist >= TEXT_LIMIT) {
      await transitionToVoice(io, debate);
    }
  } catch (e) {
    console.error('[ai] text turn error:', e.message);
    debate.isAITurn = false;
  }
}

async function handleAIVoiceTurn(io, debate) {
  debate.isAITurn = true;
  io.to(debate.id).emit('AI_TYPING');
  await new Promise(r => setTimeout(r, 2000));
  try {
    const text = await getAIResponse({
      side: debate.aiSide,
      history: [...debate.textMessages, ...debate.voiceMessages],
      phase: 'voice',
    });
    const msg = { side: debate.aiSide, isAIText: true, content: text, duration: 0, timestamp: Date.now() };
    debate.voiceMessages.push(msg);
    debate.voiceCount[debate.aiSide]++;
    advanceTurn(debate);
    debate.isAITurn = false;

    io.to(debate.id).emit('VOICE_MESSAGE_RECEIVED', msg);
    io.to(debate.id).emit('TURN_CHANGED', { turn: debate.turn });

    if (debate.voiceCount.believer >= VOICE_LIMIT && debate.voiceCount.atheist >= VOICE_LIMIT) {
      await transitionToLive(io, debate);
    }
  } catch (e) {
    console.error('[ai] voice turn error:', e.message);
    debate.isAITurn = false;
  }
}

async function transitionToVoice(io, debate) {
  debate.phase = 'voice';
  debate.turn = 'believer';
  io.to(debate.id).emit('PHASE_CHANGED', { phase: 'voice' });
  awardPoints(io, debate, 'text');

  if (debate.isAI && debate.aiSide === 'believer') {
    await handleAIVoiceTurn(io, debate);
  }
}

async function transitionToLive(io, debate) {
  debate.phase = 'live';
  io.to(debate.id).emit('PHASE_CHANGED', { phase: 'live' });
  awardPoints(io, debate, 'voice');
}

async function finishDebate(io, debate) {
  if (debate.phase === 'finished') return;
  debate.phase = 'finished';
  debate.finishedAt = Date.now();

  awardPoints(io, debate, 'live');

  let tags = ['דיון'];
  let summary = 'דיון בנושא אמונה ואתאיזם.';
  try {
    const allMessages = [...debate.textMessages];
    if (allMessages.length > 0) {
      const result = await generateDebateSummary(allMessages);
      tags = result.tags || tags;
      summary = result.summary || summary;
    }
  } catch (e) {
    console.error('[ai] summary error:', e.message);
  }

  const archived = {
    id: debate.id,
    believer: debate.believer,
    atheist: debate.atheist,
    isAI: debate.isAI,
    phases: {
      text:  { messages: debate.textMessages },
      voice: { messages: debate.voiceMessages.map(m => ({ ...m, audioB64: undefined, content: m.content })) },
    },
    stats: {
      spectatorPeak: debate.spectatorPeak,
      giftsTotal: debate.giftsReceived.believer + debate.giftsReceived.atheist,
      giftsReceived: debate.giftsReceived,
      duration: Math.round((debate.finishedAt - debate.startedAt) / 1000),
    },
    tags,
    summary,
    archivedAt: new Date().toISOString(),
  };

  store.archivedDebates.unshift(archived);
  if (store.archivedDebates.length > 500) store.archivedDebates.pop();
  saveSnapshot();

  io.to(debate.id).emit('DEBATE_FINISHED', { summary, tags });
}

function awardPoints(io, debate, completedPhase) {
  const pts = { text: 10, voice: 25, live: 50 };
  const delta = pts[completedPhase] || 0;

  for (const side of ['believer', 'atheist']) {
    const info = side === 'believer' ? debate.believer : debate.atheist;
    if (info.socketId === 'ai') continue;

    const user = store.users.get(info.socketId);
    if (!user) continue;

    user.score = (user.score || 0) + delta;
    const voiceDebate = completedPhase === 'voice' || completedPhase === 'live';
    if (voiceDebate) user.voiceDebates = (user.voiceDebates || 0) + 1;

    updateUserScore(store, info.username, delta, {
      voiceDebate,
      side: user.side,
    });

    io.to(info.socketId).emit('SCORE_UPDATED', { newScore: user.score, delta });
  }
}
