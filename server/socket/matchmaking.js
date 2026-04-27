import { v4 as uuid } from 'uuid';
import { store, createDebateState, registerUser } from '../store/memory.js';

export function registerMatchmaking(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    socket.on('disconnect', reason => console.log(`[socket] disconnected: ${socket.id} (${reason})`));

    socket.on('JOIN_QUEUE', ({ username, side }) => {
      store.users.set(socket.id, { username, side, score: 0, voiceDebates: 0, giftsReceived: 0 });
      registerUser(username);
      const oppSide = side === 'believer' ? 'atheist' : 'believer';

      if (store.queue[oppSide] && store.queue[oppSide].id !== socket.id) {
        const oppSocket = store.queue[oppSide];
        store.queue[oppSide] = null;

        const oppUser = store.users.get(oppSocket.id);
        const debateId = uuid();

        const believerSocket = side === 'believer' ? socket : oppSocket;
        const atheistSocket  = side === 'atheist'  ? socket : oppSocket;
        const believerUser   = store.users.get(believerSocket.id);
        const atheistUser    = store.users.get(atheistSocket.id);

        const debate = createDebateState(debateId,
          { socketId: believerSocket.id, username: believerUser.username },
          { socketId: atheistSocket.id,  username: atheistUser.username }
        );
        store.debates.set(debateId, debate);
        store.spectators.set(debateId, new Set());

        believerSocket.join(debateId);
        atheistSocket.join(debateId);

        io.to(debateId).emit('MATCH_FOUND', {
          debateId,
          isAI: false,
          believer: { username: believerUser.username },
          atheist:  { username: atheistUser.username },
        });

        console.log(`[match] ${believerUser.username} vs ${atheistUser.username} → ${debateId}`);
      } else {
        store.queue[side] = socket;
        socket.emit('WAITING_FOR_OPPONENT');
        console.log(`[queue] ${username} (${side}) waiting`);
      }
    });

    socket.on('REQUEST_AI_DEBATE', ({ username, side }) => {
      console.log(`[match] REQUEST_AI_DEBATE from ${username} (${side})`);
      store.users.set(socket.id, { username, side, score: 0, voiceDebates: 0, giftsReceived: 0 });
      registerUser(username);
      const aiSide = side === 'believer' ? 'atheist' : 'believer';
      const debateId = uuid();

      const believerInfo = side === 'believer'
        ? { socketId: socket.id, username }
        : { socketId: 'ai', username: 'AI' };
      const atheistInfo = side === 'atheist'
        ? { socketId: socket.id, username }
        : { socketId: 'ai', username: 'AI' };

      const debate = createDebateState(debateId, believerInfo, atheistInfo, true, aiSide);
      // User always speaks first — set turn to the user's side regardless of believer/atheist
      debate.turn = side;
      debate.isAITurn = false;
      store.debates.set(debateId, debate);
      store.spectators.set(debateId, new Set());
      socket.join(debateId);

      socket.emit('MATCH_FOUND', {
        debateId,
        isAI: true,
        aiSide,
        turn: side, // user starts
        believer: believerInfo,
        atheist:  atheistInfo,
      });

      console.log(`[ai-match] ${username} (${side}) vs AI (${aiSide}) → ${debateId} — debate.turn=${debate.turn}, isAITurn=${debate.isAITurn}, user starts`);
    });

    socket.on('LEAVE_QUEUE', () => {
      const user = store.users.get(socket.id);
      if (!user) return;
      if (store.queue[user.side]?.id === socket.id) {
        store.queue[user.side] = null;
      }
    });

    socket.on('disconnect', () => {
      const user = store.users.get(socket.id);
      if (!user) return;
      if (store.queue[user.side]?.id === socket.id) {
        store.queue[user.side] = null;
      }
    });
  });
}

async function triggerAIFirstMessage(io, debate) {
  const { getAIResponse } = await import('../ai/claudeOpponent.js');
  debate.isAITurn = true;
  io.to(debate.id).emit('AI_TYPING');
  await new Promise(r => setTimeout(r, 1500));
  try {
    const text = await getAIResponse({ side: debate.aiSide, history: [], phase: 'text' });
    const msg = { side: debate.aiSide, content: text, timestamp: Date.now(), isAI: true };
    debate.textMessages.push(msg);
    debate.textCount[debate.aiSide]++;
    debate.turn = debate.aiSide === 'believer' ? 'atheist' : 'believer';
    debate.isAITurn = false;
    io.to(debate.id).emit('TEXT_MESSAGE_RECEIVED', msg);
    io.to(debate.id).emit('TURN_CHANGED', { turn: debate.turn });
  } catch (e) {
    console.error('[ai] first message error:', e.message);
    debate.isAITurn = false;
    debate.turn = debate.aiSide === 'believer' ? 'atheist' : 'believer';
    io.to(debate.id).emit('TURN_CHANGED', { turn: debate.turn });
  }
}
