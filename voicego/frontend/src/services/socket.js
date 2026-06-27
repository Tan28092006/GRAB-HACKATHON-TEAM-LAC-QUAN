import { io } from 'socket.io-client';

let socket = null;

function getRealtimeUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('realtime') || 'http://localhost:3001';
}

export function connectSocket(callbacks = {}) {
  if (socket) return socket;
  const url = getRealtimeUrl();
  socket = io(url, { transports: ['websocket', 'polling'] });
  
  socket.on('connect', () => callbacks.onConnect?.());
  socket.on('disconnect', () => callbacks.onDisconnect?.());
  socket.on('driver-arrived', (data) => callbacks.onDriverArrived?.(data));
  socket.on('pin-verified', (data) => callbacks.onPinVerified?.(data));
  
  return socket;
}

export function emitPassengerWaiting(data) {
  if (socket) socket.emit('passenger-waiting', data);
}

export async function loginPassenger(realtimeUrl, credentials) {
  const res = await fetch(`${realtimeUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return res.json();
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
