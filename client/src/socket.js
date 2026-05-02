import { io } from 'socket.io-client';
import { getApiBaseUrl } from './lib/apiBaseUrl.js';

/** כמו REST: ב־dev כתובת ריקה → מחבר לאותו מקור דף (proxy של Vite לשרת המקומי); בלי זה הסוקט יצא לייצור והרישום התפצל */
function getSocketServerUrl() {
  return getApiBaseUrl() || null;
}

const socketOpts = { autoConnect: false, transports: ['polling', 'websocket'] };
const explicitUrl = getSocketServerUrl();
export const socket = explicitUrl ? io(explicitUrl, socketOpts) : io(socketOpts);

let connectedIdentity = null;

export function connectSocket(username, side) {
  const nextIdentity = username && side ? `${username}:${side}` : null;
  if (!nextIdentity) return;

  if (socket.connected && connectedIdentity === nextIdentity) return;

  if (socket.connected && connectedIdentity !== nextIdentity) {
    socket.disconnect();
  }

  socket.auth = { username, side };
  connectedIdentity = nextIdentity;
  socket.connect();
}

export function disconnectSocket() {
  connectedIdentity = null;
  socket.disconnect();
}
