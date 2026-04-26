import { io } from 'socket.io-client';

export const socket = io({ autoConnect: false, transports: ['websocket', 'polling'] });

export function connectSocket(username, side) {
  socket.auth = { username, side };
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}
