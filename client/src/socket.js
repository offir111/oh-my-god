import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'https://oh-my-god-production.up.railway.app';

export const socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

export function connectSocket(username, side) {
  socket.auth = { username, side };
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}
