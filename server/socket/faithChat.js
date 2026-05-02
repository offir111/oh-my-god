/**
 * צ'אט דת ואמונה: נוכחות בזמן אמת, חדר ציבורי ושיחות ישירות (מספר שיחות פרטיות במקביל).
 */
import { v4 as uuid } from 'uuid';

/** משתתפים בדיבור + ברשימת מחוברים (נוכחות) */
const ROOM = 'faith-chat-public';
/** צופים + משתתפים — מקבלים הודעות ציבוריות בלי להיות בלובי */
const ROOM_VIEW = 'faith-chat-public-view';
const MAX_TEXT = 2000;
const MAX_NAME = 40;
const MIN_INTERVAL_PUBLIC = 700;
const MIN_INTERVAL_DM = 350;
const MAX_CONCURRENT_DM_PER_USER = 8;

/** מפתח חדר מאינדוקס מאוגד — אחוזת לכל זוג משתמשים */
function dmRoomName(a, b) {
  const [x, y] = [a, b].sort();
  return `faith-dm:${x}:${y}`;
}

/** @returns {Map<string, string>} */
function getFaithDmPartnerToRoom(socket) {
  if (!socket.data.faithDmByPartner) socket.data.faithDmByPartner = new Map();
  return socket.data.faithDmByPartner;
}

/** היסטוריית צ׳אט ציבורי בזיכרון — עד שעה אחורה */
const PUBLIC_HISTORY_TTL_MS = 60 * 60 * 1000;
const PUBLIC_HISTORY_MAX = 600;

/** אם קיים ובהתאמה בשקע — ניתן למחוק הודעות ציבור/פרט מהשרת (מנהלי צ׳אט בלבד) */
function getFaithChatModeratorSecret() {
  const s = typeof process.env.FAITH_CHAT_MOD_SECRET === 'string' ? process.env.FAITH_CHAT_MOD_SECRET.trim() : '';
  return s.length >= 8 ? s : '';
}

function getFaithChatModeratorUsernameLc() {
  const u = typeof process.env.FAITH_CHAT_MOD_USERNAME === 'string' ? process.env.FAITH_CHAT_MOD_USERNAME.trim() : '';
  return u.length >= 2 ? u.toLowerCase() : '';
}

function isModeratorByConfiguredUsername(displayName, loginClaim, modUserLc) {
  if (!modUserLc || typeof loginClaim !== 'string' || !loginClaim.trim()) return false;
  const claimLc = loginClaim.trim().toLowerCase();
  const nameLc = typeof displayName === 'string' ? displayName.trim().toLowerCase() : '';
  return claimLc === modUserLc && nameLc === modUserLc;
}

/** @type {{ id: string, fromSocketId: string, displayName: string, text: string, ts: number, color?: string }[]} */
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

/**
 * כניסה / יציאה / ניתוק — לא נשמרים בהיסטוריית ההודעות, רק שידור חי למחוברים ל־ROOM_VIEW.
 */
function emitFaithPublicSystem(io, systemType, displayName) {
  const safe =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim().slice(0, MAX_NAME)
      : 'אורח';
  const texts = {
    join: `${safe} התחבר/ה לצ'אט`,
    leave: `${safe} עזב/ה את הצ'אט`,
    disconnect: `${safe} נותק/ה מהצ'אט`,
  };
  if (!texts[systemType]) return;
  const payload = {
    id: uuid(),
    kind: 'system',
    systemType,
    displayName: safe,
    text: texts[systemType],
    ts: Date.now(),
  };
  io.to(ROOM_VIEW).emit('FAITH_CHAT_SYSTEM', payload);
}

function getPublicHistorySnapshot() {
  prunePublicHistoryBuffer();
  return publicHistoryBuffer.map(m => ({ ...m }));
}

function sanitizeFaithMessageColor(raw) {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) return s;
  return undefined;
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {string} partnerId
 * @param {string} partnerReason
 */
function closeFaithDmOne(io, socket, partnerId, partnerReason) {
  const myMap = getFaithDmPartnerToRoom(socket);
  const room = myMap.get(partnerId);
  if (!room) return;
  socket.leave(room);
  myMap.delete(partnerId);
  const partner = io.sockets.sockets.get(partnerId);
  if (partner) {
    const pMap = getFaithDmPartnerToRoom(partner);
    if (pMap.get(socket.id) === room) {
      partner.leave(room);
      pMap.delete(socket.id);
    }
    partner.emit('FAITH_DM_ENDED', { reason: partnerReason, partnerSocketId: socket.id });
  }
}

export function registerFaithChat(io) {
  const modSecretConfigured = getFaithChatModeratorSecret();
  const modUsernameLc = getFaithChatModeratorUsernameLc();
  const lastPublic = new Map();
  /** מפתח: `${senderId}:${partnerId}` — קצב פר שיחה */
  const lastDmPair = new Map();
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

  function dmThrottleOk(senderId, partnerId, now, minGap) {
    const k = `${senderId}:${partnerId}`;
    const prev = lastDmPair.get(k) || 0;
    if (now - prev < minGap) return false;
    lastDmPair.set(k, now);
    return true;
  }

  io.on('connection', socket => {
    socket.data.faithDmByPartner = new Map();
    socket.data.faithBlockIncomingPm = false;
    socket.data.faithChatModerator = false;
    socket.data.faithChatModSecretOk = false;
    socket.data.faithModeratorLoginClaim = '';

    socket.on('FAITH_PUBLIC_WATCH', () => {
      socket.join(ROOM_VIEW);
      socket.emit('FAITH_PUBLIC_HISTORY', { messages: getPublicHistorySnapshot() });
    });

    socket.on('FAITH_PUBLIC_UNWATCH', () => {
      socket.leave(ROOM_VIEW);
    });

    socket.on(
      'FAITH_CHAT_JOIN',
      ({ displayName, moderatorSecret, moderatorLoginUsername } = {}) => {
        let name = typeof displayName === 'string' ? displayName.trim().slice(0, MAX_NAME) : '';
        if (!name) name = 'אורח';
        const modSecret =
          Boolean(modSecretConfigured) &&
          typeof moderatorSecret === 'string' &&
          moderatorSecret === modSecretConfigured;
        const loginClaim =
          typeof moderatorLoginUsername === 'string' ? moderatorLoginUsername.trim().slice(0, MAX_NAME) : '';
        socket.data.faithChatModSecretOk = modSecret;
        socket.data.faithModeratorLoginClaim = loginClaim;
        const modByUser = isModeratorByConfiguredUsername(name, loginClaim, modUsernameLc);
        socket.data.faithChatModerator = Boolean(modSecret || modByUser);
        presence.set(socket.id, { displayName: name, joinedAt: Date.now() });
        socket.join(ROOM);
        socket.join(ROOM_VIEW);
        broadcastPresence();
        socket.emit('FAITH_SOCKET_ID', { socketId: socket.id });
        socket.emit('FAITH_PUBLIC_HISTORY', { messages: getPublicHistorySnapshot() });
        socket.emit('FAITH_MODERATOR_STATUS', { active: socket.data.faithChatModerator });
        emitFaithPublicSystem(io, 'join', name);
      },
    );

    socket.on('FAITH_UPDATE_DISPLAY_NAME', ({ displayName } = {}) => {
      const cur = presence.get(socket.id);
      if (!cur) return;
      let name = typeof displayName === 'string' ? displayName.trim().slice(0, MAX_NAME) : '';
      if (!name) name = 'אורח';
      cur.displayName = name;
      if (!socket.data.faithChatModSecretOk) {
        socket.data.faithChatModerator = isModeratorByConfiguredUsername(
          name,
          socket.data.faithModeratorLoginClaim,
          modUsernameLc,
        );
        socket.emit('FAITH_MODERATOR_STATUS', { active: socket.data.faithChatModerator });
      }
      broadcastPresence();
    });

    socket.on('FAITH_BLOCK_INCOMING_PM', ({ block } = {}) => {
      if (!presence.has(socket.id)) return;
      socket.data.faithBlockIncomingPm = !!block;
    });

    socket.on('FAITH_MODERATOR_DELETE_PUBLIC', ({ messageId } = {}) => {
      if (!socket.data.faithChatModerator) return;
      if (typeof messageId !== 'string' || messageId.length < 4 || messageId.length > 128) return;
      publicHistoryBuffer = publicHistoryBuffer.filter(m => m.id !== messageId);
      io.to(ROOM_VIEW).emit('FAITH_PUBLIC_MESSAGE_DELETED', { messageId });
    });

    socket.on('FAITH_MODERATOR_DELETE_DM', ({ messageId, roomId } = {}) => {
      if (!socket.data.faithChatModerator) return;
      if (typeof messageId !== 'string' || messageId.length < 4 || messageId.length > 128) return;
      if (typeof roomId !== 'string' || !roomId.startsWith('faith-dm:')) return;
      io.to(roomId).emit('FAITH_DM_MESSAGE_DELETED', { messageId });
    });

    socket.on('FAITH_CHAT_MESSAGE', ({ text, color } = {}) => {
      if (!presence.has(socket.id)) return;
      const t = typeof text === 'string' ? text.trim() : '';
      if (!t || t.length > MAX_TEXT) return;
      const now = Date.now();
      const prev = lastPublic.get(socket.id) || 0;
      if (now - prev < MIN_INTERVAL_PUBLIC) return;
      lastPublic.set(socket.id, now);
      const meta = presence.get(socket.id);
      const c = sanitizeFaithMessageColor(color);
      const payload = {
        id: uuid(),
        fromSocketId: socket.id,
        displayName: meta.displayName,
        text: t.slice(0, MAX_TEXT),
        ts: now,
        ...(c ? { color: c } : {}),
      };
      pushPublicHistory(payload);
      io.to(ROOM_VIEW).emit('FAITH_CHAT_MESSAGE', payload);
    });

    socket.on('FAITH_DM_OPEN', ({ targetSocketId } = {}) => {
      if (!presence.has(socket.id) || typeof targetSocketId !== 'string') return;
      if (targetSocketId === socket.id) return;
      if (!presence.has(targetSocketId)) return;

      const target = io.sockets.sockets.get(targetSocketId);
      if (!target || !target.rooms?.has(ROOM)) return;

      const myMap = getFaithDmPartnerToRoom(socket);
      if (myMap.has(targetSocketId)) {
        const roomExisting = myMap.get(targetSocketId);
        socket.emit('FAITH_DM_OPENED', {
          roomId: roomExisting,
          partnerSocketId: targetSocketId,
          partnerName: presence.get(targetSocketId).displayName,
        });
        return;
      }

      if (target.data.faithBlockIncomingPm) {
        socket.emit('FAITH_DM_ERROR', {
          message: 'לא ניתן לפתוח שיחה — המשתמש חוסם פניות פרטיות.',
          targetSocketId,
        });
        return;
      }

      if (myMap.size >= MAX_CONCURRENT_DM_PER_USER) {
        socket.emit('FAITH_DM_ERROR', {
          message: `הגעת למקסימום שיחות פרטיות (${MAX_CONCURRENT_DM_PER_USER}). סגור אחת לפני שנוספת.`,
          targetSocketId,
        });
        return;
      }

      const tMap = getFaithDmPartnerToRoom(target);
      if (tMap.size >= MAX_CONCURRENT_DM_PER_USER) {
        socket.emit('FAITH_DM_ERROR', { message: 'המשתמש השני בשיחות פרטיות מלאות — נסה שוב מאוחר יותר.', targetSocketId });
        return;
      }

      const room = dmRoomName(socket.id, targetSocketId);
      socket.join(room);
      target.join(room);
      myMap.set(targetSocketId, room);
      tMap.set(socket.id, room);

      socket.emit('FAITH_DM_OPENED', {
        roomId: room,
        partnerSocketId: targetSocketId,
        partnerName: presence.get(targetSocketId).displayName,
      });
      target.emit('FAITH_DM_OPENED', {
        roomId: room,
        partnerSocketId: socket.id,
        partnerName: presence.get(socket.id).displayName,
      });
    });

    socket.on('FAITH_DM_MESSAGE', ({ text, partnerSocketId, color } = {}) => {
      if (!presence.has(socket.id)) return;
      if (typeof partnerSocketId !== 'string') {
        socket.emit('FAITH_DM_ERROR', { message: 'בחר שיחה פרטית לפני השליחה.' });
        return;
      }
      const room = getFaithDmPartnerToRoom(socket).get(partnerSocketId);
      if (!room) {
        socket.emit('FAITH_DM_ERROR', {
          message: 'שיחה פרטית לא פעלה — סגרו ובחרו משתמש שוב.',
          targetSocketId: partnerSocketId,
        });
        return;
      }
      const t = typeof text === 'string' ? text.trim() : '';
      if (!t || t.length > MAX_TEXT) return;
      const now = Date.now();
      if (!dmThrottleOk(socket.id, partnerSocketId, now, MIN_INTERVAL_DM)) return;
      const meta = presence.get(socket.id);
      const c = sanitizeFaithMessageColor(color);
      const dmPayload = {
        id: uuid(),
        roomId: room,
        fromSocketId: socket.id,
        displayName: meta.displayName,
        text: t.slice(0, MAX_TEXT),
        ts: now,
        ...(c ? { color: c } : {}),
      };
      io.to(room).emit('FAITH_DM_MESSAGE', dmPayload);
    });

    socket.on('FAITH_DM_TYPING', ({ typing, partnerSocketId } = {}) => {
      if (!presence.has(socket.id)) return;
      if (typeof partnerSocketId !== 'string') return;
      const room = getFaithDmPartnerToRoom(socket).get(partnerSocketId);
      if (!room) return;
      socket.to(room).emit('FAITH_DM_TYPING', {
        fromSocketId: socket.id,
        partnerSocketId: socket.id,
        typing: !!typing,
      });
    });

    socket.on('FAITH_DM_LEAVE', ({ partnerSocketId } = {}) => {
      if (typeof partnerSocketId !== 'string') return;
      const myMap = getFaithDmPartnerToRoom(socket);
      if (!myMap.has(partnerSocketId)) return;
      closeFaithDmOne(io, socket, partnerSocketId, 'partner_left');
      socket.emit('FAITH_DM_ENDED', { reason: 'self_left', partnerSocketId });
    });

    socket.on('FAITH_CHAT_LEAVE', () => {
      const leaveName = presence.get(socket.id)?.displayName;
      const partners = [...getFaithDmPartnerToRoom(socket).keys()];
      for (const pid of partners) {
        closeFaithDmOne(io, socket, pid, 'partner_left');
        socket.emit('FAITH_DM_ENDED', { reason: 'lobby_left', partnerSocketId: pid });
      }
      socket.leave(ROOM);
      socket.data.faithChatModerator = false;
      socket.data.faithChatModSecretOk = false;
      socket.data.faithModeratorLoginClaim = '';
      socket.data.faithBlockIncomingPm = false;
      getFaithDmPartnerToRoom(socket).clear();
      presence.delete(socket.id);
      broadcastPresence();
      if (leaveName) emitFaithPublicSystem(io, 'leave', leaveName);
    });

    socket.on('disconnect', () => {
      const discName = presence.get(socket.id)?.displayName;
      lastPublic.delete(socket.id);
      for (const k of [...lastDmPair.keys()]) {
        const sep = k.indexOf(':');
        if (sep < 1) continue;
        const a = k.slice(0, sep);
        const b = k.slice(sep + 1);
        if (a === socket.id || b === socket.id) lastDmPair.delete(k);
      }
      socket.data.faithChatModerator = false;
      socket.data.faithChatModSecretOk = false;
      socket.data.faithModeratorLoginClaim = '';
      const partners = [...getFaithDmPartnerToRoom(socket).keys()];
      for (const pid of partners) {
        closeFaithDmOne(io, socket, pid, 'partner_disconnected');
      }
      getFaithDmPartnerToRoom(socket).clear();
      presence.delete(socket.id);
      broadcastPresence();
      if (discName) emitFaithPublicSystem(io, 'disconnect', discName);
    });
  });
}
