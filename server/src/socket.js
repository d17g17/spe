'use strict';

const logger = require('./utils/logger');

let io = null;

const init = (server) => {
  if (io) return io;
  io = server;
  io.on('connection', (socket) => {
    logger.debug(`socket connected: ${socket.id}`);
    socket.emit('connection:status', { status: 'connected', socketId: socket.id });

    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb({ pong: true, t: Date.now() });
      else socket.emit('pong', { t: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`socket disconnected: ${socket.id} (${reason})`);
    });
  });
  return io;
};

const emit = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

const get = () => io;

module.exports = { init, emit, get };
