/**
 * צ'אט דת ואמונה: נוכחות בזמן אמת, חדר ציבורי, ושיחות ישירות (בקשה → אישור).
 */
import { v4 as uuid } from 'uuid';

/** משתתפים בדיבור + ברשימת מחוברים (נוכחות) */
const ROOM = 'faith-chat-public';
/** צופים + משתתפים — מקבלים הודעות ציבוריות בלי להיות בלובי */
const ROOM_VIEW = 'faith-chat-public-view';
const MAX_TEXT = 2000;
const MAX_DM_NOTE = 240;
const MAX_NAME = 40;
const MIN_INTERVAL_PUBLIC = 700;
const MIN_INTERVAL_DM = 350;
/** היסטוריית צ׳אט ציבורי בזיכרון — עד שעה אחורה */
const PUBLIC_HISTORY_TTL_MS = 60 * 60 * 1000;
const PUBLIC_HISTORY_MAX = 600;

/** @type {{ id: string, fromSocketId: string, displayName: string, text: string, ts: number }[]} */
let publicHistoryBuffer = [];

function prunePublicHistoryBuffer() {
  const cutoff = Date.now() - PUBLIC_HISTORY_TTL_MS;
  publicHistoryBuffer = publicHistoryBuffer.filter(m => m.ts >= cutoff);
  if (publicHistoryBuffer.length > PUBLIC_HISTORY_MAX) {
    publicHistoryBuffer = publicHistoryBuffer.slice(-PUBLIC_HISTORY_MAX);
  }
}

function pushPublicHistory(msg) {
  publicHistoryBuffer.push(msg);
  prunePublicHistoryBuffer();
}

function getPublicHistorySnapshot() {
  prunePublicHistoryBuffer();
  return publicHistoryBuffer.map(m => ({ ...m }));
}

function dmRoomName(a, b) {
  const [x, y] = [a, b].sort();
  return `faith-dm:${x}:${y}`;
}

function endDmForPartner(io, socket, reasonForPartner) {
  const room = socket.data.faithDmRoom;
  const partnerId = socket.data.faithDmPartner;
  if (room) socket.leave(room);
  socket.data.faithDmRoom = null;
  socket.data.faithDmPartner = null;
  if (partnerId) {
    const partner = io.sockets.sockets.get(partnerId);
    if (partner) {
      if (partner.data.faithDmRoom === room) partner.leave(room);
      partner.data.faithDmRoom = null;
      partner.data.faithDmPartner = null;
      partner.emit('FAITH_DM_ENDED', { reason: reasonForPartner });
    }
  }
}

export function registerFaithChat(io) {
  const lastPublic = new Map();
  const lastDm = new Map();
  /** @type {Map<string, { displayName: string, joinedAt: number }>} */
  const presence = new Map();

  function listUsers() {
    return [...presence.entries()].map(([socketId, v]) => ({
      socketId,
      displayName: v.displayName,
      joinedAt: v.joinedAt,
    }));
  }

  function broadcastPresence() {
    io.to(ROOM_VIEW).emit('FAITH_PRESENCE_LIST', { users: listUsers() });
  }

  io.on('connection', (socket) => {
    socket.data.faithDmRoom = null;
    socket.data.faithDmPartner = null;

    socket.on('FAITH_PUBLIC_WATCH', () => {
      socket.join(ROOM_VIEW);
      socket.emit('FAITH_PUBLIC_HISTORY', { messages: getPublicHistorySnapshot() });
    });

    socket.on('FAITH_PUBLIC_UNWATCH', () => {
      socket.leave(ROOM_VIEW);
    });

    socket.on('FAITH_CHAT_JOIN', ({ displayName } = {}) => {
      let name = typeof displayName === 'string' ? displayName.trim().slice(0, MAX_NAME) : '';
      if (!name) name = 'אורח';
      presence.set(socket.id, { displayName: name, joinedAt: Date.now() });
      socket.join(ROOM);
      socket.join(ROOM_VIEW);
      broadcastPresence();
      socket.emit('FAITH_SOCKET_ID', { socketId: socket.id });
      socket.emit('FAITH_PUBLIC_HISTORY', { messages: getPublicHistorySnapshot() });
    });

    socket.on('FAITH_UPDATE_DISPLAY_NAME', ({ displayName } = {}) => {
      const cur = presence.get(socket.id);
      if (!cur) return;
      let name = typeof displayName === 'string' ? displayName.trim().slice(0, MAX_NAME) : '';
      if (!name) name = 'אורח';
      cur.displayName = name;
      broadcastPresence();
    });

    socket.on('FAITH_CHAT_MESSAGE', ({ text } = {}) => {
      if (!presence.has(socket.id)) return;
      const t = typeof text === 'string' ? text.trim() : '';
      if (!t || t.length > MAX_TEXT) return;
      const now = Date.now();
      const prev = lastPublic.get(socket.id) || 0;
      if (now - prev < MIN_INTERVAL_PUBLIC) return;
      lastPublic.set(socket.id, now);
      const meta = presence.get(socket.id);
      const payload = {
        id: uuid(),
        fromSocketId: socket.id,
        displayName: meta.displayName,
        text: t.slice(0, MAX_TEXT),
        ts: now,
      };
      pushPublicHistory(payload);
      io.to(ROOM_VIEW).emit('FAITH_CHAT_MESSAGE', payload);
    });

    socket.on('FAITH_DM_REQUEST', ({ targetSocketId, note } = {}) => {
      if (!presence.has(socket.id) || typeof targetSocketId !== 'string') return;
      if (targetSocketId === socket.id) return;
      if (!presence.has(targetSocketId)) return;

      const target = io.sockets.sockets.get(targetSocketId);
      if (!target || !target.rooms?.has(ROOM)) return;

      if (socket.data.faithDmRoom || target.data.faithDmRoom) {
        socket.emit('FAITH_DM_ERROR', { message: 'אחד מכם כבר בשיחה פרטית. יש לסיים קודם.' });
        return;
      }

      const n = typeof note === 'string' ? note.trim().slice(0, MAX_DM_NOTE) : '';
      const fromMeta = presence.get(socket.id);
      const toMeta = presence.get(targetSocketId);
      const requestId = uuid();

      target.emit('FAITH_DM_REQUEST_INCOMING', {
        requestId,
        fromSocketId: socket.id,
        fromName: fromMeta.displayName,
        note: n || undefined,
      });
      socket.emit('FAITH_DM_REQUEST_SENT', {
        requestId,
        targetSocketId,
        targetName: toMeta.displayName,
      });
    });

    socket.on('FAITH_DM_RESPOND', ({ accept, fromSocketId } = {}) => {
      if (!presence.has(socket.id) || typeof fromSocketId !== 'string') return;
      if (fromSocketId === socket.id) return;

      const requester = io.sockets.sockets.get(fromSocketId);
      if (!requester || !presence.has(fromSocketId)) {
        socket.emit('FAITH_DM_ERROR', { message: 'המשתמש כבר לא מחובר' });
        return;
      }

      if (!accept) {
        requester.emit('FAITH_DM_REJECTED', {
          bySocketId: socket.id,
          byName: presence.get(socket.id).displayName,
        });
        return;
      }

      if (socket.data.faithDmRoom || requester.data.faithDmRoom) {
        socket.emit('FAITH_DM_ERROR', { message: 'לא ניתן להתחיל שיחה — צד אחד כבר בשיחה פרטית.' });
        requester.emit('FAITH_DM_ERROR', { message: 'לא ניתן להתחיל שיחה — צד אחד כבר בשיחה פרטית.' });
        return;
      }

      const room = dmRoomName(socket.id, fromSocketId);
      socket.join(room);
      requester.join(room);
      socket.data.faithDmRoom = room;
      socket.data.faithDmPartner = fromSocketId;
      requester.data.faithDmRoom = room;
      requester.data.faithDmPartner = socket.id;

      socket.emit('FAITH_DM_OPENED', {
        roomId: room,
        partnerSocketId: fromSocketId,
        partnerName: presence.get(fromSocketId).displayName,
      });
      requester.emit('FAITH_DM_OPENED', {
        roomId: room,
        partnerSocketId: socket.id,
        partnerName: presence.get(socket.id).displayName,
      });
    });

    socket.on('FAITH_DM_MESSAGE', ({ text } = {}) => {
      const room = socket.data.faithDmRoom;
      if (!room || !presence.has(socket.id)) return;
      const t = typeof text === 'string' ? text.trim() : '';
      if (!t || t.length > MAX_TEXT) return;
      const now = Date.now();
      const prev = lastDm.get(socket.id) || 0;
      if (now - prev < MIN_INTERVAL_DM) return;
      lastDm.set(socket.id, now);
      const meta = presence.get(socket.id);
      const dmPayload = {
        id: uuid(),
        fromSocketId: socket.id,
        displayName: meta.displayName,
        text: t.slice(0, MAX_TEXT),
        ts: now,
      };
      io.to(room).emit('FAITH_DM_MESSAGE', dmPayload);
    });

    socket.on('FAITH_DM_TYPING', ({ typing } = {}) => {
      const room = socket.data.faithDmRoom;
      if (!room) return;
      socket.to(room).emit('FAITH_DM_TYPING', {
        fromSocketId: socket.id,
        typing: !!typing,
      });
    });

    socket.on('FAITH_DM_LEAVE', () => {
      if (!socket.data.faithDmRoom) return;
      endDmForPartner(io, socket, 'partner_left');
      socket.emit('FAITH_DM_ENDED', { reason: 'self_left' });
    });

    socket.on('FAITH_CHAT_LEAVE', () => {
      const hadDm = !!socket.data.faithDmRoom;
      if (hadDm) {
        endDmForPartner(io, socket, 'partner_left');
        socket.emit('FAITH_DM_ENDED', { reason: 'lobby_left' });
      }
      socket.leave(ROOM);
      presence.delete(socket.id);
      broadcastPresence();
    });

    socket.on('disconnect', () => {
      lastPublic.delete(socket.id);
      lastDm.delete(socket.id);
      if (socket.data.faithDmRoom) {
        endDmForPartner(io, socket, 'partner_disconnected');
      }
      presence.delete(socket.id);
      broadcastPresence();
    });
  });
}
