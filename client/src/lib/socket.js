import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

let socket = null;

const ensure = () => {
  if (socket) return socket;
  socket = io(URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  return socket;
};

export const on = (event, handler) => {
  const s = ensure();
  s.on(event, handler);
  return () => s.off(event, handler);
};

export const emit = (event, payload) => {
  ensure().emit(event, payload);
};

export const getSocket = () => ensure();
