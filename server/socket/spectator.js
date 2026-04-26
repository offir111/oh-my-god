import { store, updateUserScore } from '../store/memory.js';

const ALLOWED_GIFTS = ['🔥', '💡', '👏', '🎯', '⚡', '🌟', '💪', '🤔', '😤', '🎤'];
const GIFT_COOLDOWN_MS = 2000;
const giftCooldowns = new Map(); // socketId → timestamp

export function registerSpectator(io) {
  io.on('connection', (socket) => {

    socket.on('SPECTATE_DEBATE', ({ debateId }) => {
      const debate = store.debates.get(debateId);
      if (!debate) {
        socket.emit('SPECTATE_ERROR', { message: 'דיון לא נמצא' });
        return;
      }

      socket.join(`spec:${debateId}`);
      if (!store.spectators.has(debateId)) store.spectators.set(debateId, new Set());
      store.spectators.get(debateId).add(socket.id);

      const count = store.spectators.get(debateId).size;
      if (count > (debate.spectatorPeak || 0)) debate.spectatorPeak = count;

      io.to(debateId).emit('SPECTATOR_COUNT_UPDATED', { count });

      socket.emit('SPECTATOR_STATE', {
        debate: sanitizeDebate(debate),
        count,
      });
    });

    socket.on('LEAVE_SPECTATE', ({ debateId }) => {
      leaveSpectate(socket, debateId, io);
    });

    socket.on('SEND_GIFT', ({ debateId, targetSide, emoji }) => {
      if (!ALLOWED_GIFTS.includes(emoji)) return;
      if (!['believer', 'atheist'].includes(targetSide)) return;

      const now = Date.now();
      const last = giftCooldowns.get(socket.id) || 0;
      if (now - last < GIFT_COOLDOWN_MS) return;
      giftCooldowns.set(socket.id, now);

      const debate = store.debates.get(debateId);
      if (!debate || debate.phase === 'finished') return;

      debate.giftsReceived[targetSide] = (debate.giftsReceived[targetSide] || 0) + 1;

      const targetInfo = targetSide === 'believer' ? debate.believer : debate.atheist;
      if (targetInfo.socketId !== 'ai') {
        const targetUser = store.users.get(targetInfo.socketId);
        if (targetUser) {
          targetUser.score = (targetUser.score || 0) + 1;
          updateUserScore(store, targetInfo.username, 1, { gift: true });
          io.to(targetInfo.socketId).emit('SCORE_UPDATED', { newScore: targetUser.score, delta: 1 });
        }
      }

      const giftEvent = { targetSide, emoji, id: `${Date.now()}-${Math.random()}` };
      io.to(debateId).emit('GIFT_RECEIVED', giftEvent);
      io.to(`spec:${debateId}`).emit('GIFT_RECEIVED', giftEvent);
    });

    socket.on('disconnect', () => {
      giftCooldowns.delete(socket.id);
      for (const [debateId, set] of store.spectators.entries()) {
        if (set.has(socket.id)) {
          leaveSpectate(socket, debateId, io);
        }
      }
    });
  });
}

function leaveSpectate(socket, debateId, io) {
  socket.leave(`spec:${debateId}`);
  const set = store.spectators.get(debateId);
  if (set) {
    set.delete(socket.id);
    io.to(debateId).emit('SPECTATOR_COUNT_UPDATED', { count: set.size });
  }
}

function sanitizeDebate(debate) {
  return {
    id: debate.id,
    phase: debate.phase,
    turn: debate.turn,
    believer: { username: debate.believer.username },
    atheist:  { username: debate.atheist.username },
    isAI: debate.isAI,
    textMessages: debate.textMessages,
    voiceMessages: debate.voiceMessages.map(m => ({ ...m, audioB64: undefined })),
    textCount: debate.textCount,
    voiceCount: debate.voiceCount,
    giftsReceived: debate.giftsReceived,
    startedAt: debate.startedAt,
  };
}
