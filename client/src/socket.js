import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'https://oh-my-god-production.up.railway.app';

export const socket = io(SERVER_URL, { autoConnect: false, transports: ['polling', 'websocket'] });

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
