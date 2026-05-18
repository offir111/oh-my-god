import { v4 as uuid } from 'uuid';
import { store, createDebateState, registerUserFromSocket, isUsernameBlocked } from '../store/memory.js';
import { getRandomVirtualOpponent } from '../data/virtualUsers.js';

export function registerMatchmaking(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // רישום כמחובר מיד בחיבור (לנורה הירוקה בפרופיל)
    const authUsername = typeof socket.auth?.username === 'string' ? socket.auth.username.trim() : null;
    const authSide = socket.auth?.side;
    if (authUsername && (authSide === 'believer' || authSide === 'atheist')) {
      store.users.set(socket.id, { username: authUsername, side: authSide, score: 0, voiceDebates: 0, giftsReceived: 0 });
    }

    socket.on('disconnect', reason => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      store.users.delete(socket.id);
    });

    socket.on('JOIN_QUEUE', ({ username, side }) => {
      if (!isValidMatchUser(username, side)) {
        socket.emit('MATCH_ERROR', { message: 'פרטי משתמש לא תקינים' });
        return;
      }
      username = username.trim();
      if (isUsernameBlocked(username)) {
        socket.emit('MATCH_ERROR', { message: 'החשבון חסום. לפרטים ניתן לפנות דרך «צור קשר».' });
        return;
      }
      store.users.set(socket.id, { username, side, score: 0, voiceDebates: 0, giftsReceived: 0 });
      registerUserFromSocket(username);
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
        // הודע לכל דיוני-וירטואלי שמחכים ליוזר מהצד הזה
        for (const [, d] of store.debates) {
          if (d.isAI && d.fromHumanQueue && d.aiSide === side && d.phase !== 'finished') {
            io.to(d.id).emit('HUMAN_IN_QUEUE', { side });
          }
        }
      }
    });

    // ── בדיקה: האם יש יוזר אנושי בתור עבור צד מסוים ──
    socket.on('CHECK_HUMAN_QUEUE', ({ side }) => {
      socket.emit('HUMAN_QUEUE_STATUS', { available: !!store.queue[side] });
    });

    // ── מעבר מוירטואלי ליוזר אנושי ──
    socket.on('SWITCH_TO_HUMAN', ({ debateId, username, side }) => {
      const oppSide = side === 'believer' ? 'atheist' : 'believer';
      const humanSocket = store.queue[oppSide];
      if (!humanSocket) {
        socket.emit('SWITCH_FAILED', { message: 'היריב כבר לא זמין, המשך עם הוירטואלי' });
        return;
      }
      // הוצא אנושי מהתור
      store.queue[oppSide] = null;

      // צור דיון אנושי חדש
      const newDebateId = uuid();
      const humanUser = store.users.get(humanSocket.id);
      if (!humanUser) { socket.emit('SWITCH_FAILED', { message: 'שגיאה בחיבור' }); return; }

      store.users.set(socket.id, { username, side, score: 0, voiceDebates: 0, giftsReceived: 0 });
      const believerSocket = side === 'believer' ? socket : humanSocket;
      const atheistSocket  = side === 'atheist'  ? socket : humanSocket;
      const believerUser   = store.users.get(believerSocket.id);
      const atheistUser    = store.users.get(atheistSocket.id);

      const debate = createDebateState(newDebateId,
        { socketId: believerSocket.id, username: believerUser.username },
        { socketId: atheistSocket.id,  username: atheistUser.username }
      );
      store.debates.set(newDebateId, debate);
      store.spectators.set(newDebateId, new Set());

      believerSocket.join(newDebateId);
      atheistSocket.join(newDebateId);

      io.to(newDebateId).emit('MATCH_FOUND', {
        debateId: newDebateId,
        isAI: false,
        believer: { username: believerUser.username },
        atheist:  { username: atheistUser.username },
      });
      console.log(`[switch-to-human] ${username} switched from virtual to ${humanUser.username} → ${newDebateId}`);
    });

    socket.on('REQUEST_AI_DEBATE', ({ username, side, firstMessage }) => {
      if (!isValidMatchUser(username, side)) {
        socket.emit('MATCH_ERROR', { message: 'פרטי משתמש לא תקינים' });
        return;
      }
      username = username.trim();
      if (isUsernameBlocked(username)) {
        socket.emit('MATCH_ERROR', { message: 'החשבון חסום. לפרטים ניתן לפנות דרך «צור קשר».' });
        return;
      }
      console.log(`[match] REQUEST_AI_DEBATE from ${username} (${side})`);
      store.users.set(socket.id, { username, side, score: 0, voiceDebates: 0, giftsReceived: 0 });
      registerUserFromSocket(username);
      const aiSide = side === 'believer' ? 'atheist' : 'believer';
      const debateId = uuid();

      // Pick a virtual persona for the AI opponent
      const virtualOpponent = getRandomVirtualOpponent(side);
      const aiDisplayName = virtualOpponent ? virtualOpponent.displayName : 'AI';

      const believerInfo = side === 'believer'
        ? { socketId: socket.id, username }
        : { socketId: 'ai', username: aiDisplayName };
      const atheistInfo = side === 'atheist'
        ? { socketId: socket.id, username }
        : { socketId: 'ai', username: aiDisplayName };

      const debate = createDebateState(debateId, believerInfo, atheistInfo, true, aiSide);
      // User always speaks first — set turn to the user's side regardless of believer/atheist
      debate.turn = side;
      debate.isAITurn = false;
      // Attach the virtual persona so debate.js can use it for richer responses
      debate.virtualOpponent = virtualOpponent || null;
      // Mark if started from human queue (for HUMAN_IN_QUEUE notifications)
      debate.fromHumanQueue = !!firstMessage;
      store.debates.set(debateId, debate);
      store.spectators.set(debateId, new Set());
      socket.join(debateId);

      socket.emit('MATCH_FOUND', {
        debateId,
        isAI: true,
        aiSide,
        turn: side,
        believer: believerInfo,
        atheist:  atheistInfo,
        virtualOpponent: virtualOpponent
          ? {
              displayName: virtualOpponent.displayName,
              age:          virtualOpponent.age,
              city:         virtualOpponent.city,
              occupation:   virtualOpponent.occupation,
              bio:          virtualOpponent.bio,
              side:         virtualOpponent.side,
            }
          : null,
      });

      // אם הגיע מתור אנושי — הוירטואלי פותח עם 3 שניות typing ואז "היי"
      if (firstMessage) {
        setTimeout(() => {
          // הצג אינדיקטור כתיבה
          io.to(debateId).emit('AI_TYPING');
          // אחרי 3 שניות — שלח "היי"
          setTimeout(() => {
            const hiMsg = { side: aiSide, content: 'היי', timestamp: Date.now(), isAI: true };
            debate.textMessages.push(hiMsg);
            debate.textCount[aiSide]++;
            debate.turn = side;
            io.to(debateId).emit('TEXT_MESSAGE_RECEIVED', hiMsg);
            io.to(debateId).emit('TURN_CHANGED', { turn: side });
          }, 3000);
        }, 800);
      }

      console.log(`[ai-match] ${username} (${side}) vs ${aiDisplayName} (${aiSide}) → ${debateId} — user starts${firstMessage ? ' [fromHumanQueue]' : ''}`);
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

function isValidMatchUser(username, side) {
  return typeof username === 'string'
    && username.trim().length >= 2
    && username.trim().length <= 64
    && ['believer', 'atheist'].includes(side);
}

async function triggerAIFirstMessage(io, debate) {
  const { getAIResponse } = await import('../ai/claudeOpponent.js');
  debate.isAITurn = true;
  io.to(debate.id).emit('AI_TYPING');
  await new Promise(r => setTimeout(r, 1500));
  try {
    // Pass virtualOpponent so the AI introduces itself and uses the persona
    const text = await getAIResponse({
      side: debate.aiSide,
      history: [],
      phase: 'text',
      virtualUser: debate.virtualOpponent || null,
    });
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
