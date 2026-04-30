import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'https://oh-my-god-production.up.railway.app';

/** חיבור נפרד מדיונים — לצרכי צ'אט ציבורי בדף דת ואמונה */
export const faithSocket = io(SERVER_URL, { autoConnect: false, transports: ['polling', 'websocket'] });

let joinRefCount = 0;

export function ensureFaithChatConnected() {
  if (!faithSocket.connected) faithSocket.connect();
}

export function releaseFaithChatConnection() {
  joinRefCount = Math.max(0, joinRefCount - 1);
  if (joinRefCount === 0 && faithSocket.connected) {
    faithSocket.disconnect();
  }
}

export function acquireFaithChatConnection() {
  joinRefCount++;
  ensureFaithChatConnected();
}
