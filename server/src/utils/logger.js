'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

let fileStream = null;
if (config.logFile) {
  try {
    fs.mkdirSync(config.logDir, { recursive: true });
    fileStream = fs.createWriteStream(path.join(config.logDir, 'server.log'), { flags: 'a' });
  } catch (_) {
    fileStream = null;
  }
}

const fmt = (level, scope, msg, meta) => {
  const time = new Date().toISOString();
  const base = `${time} [${level.toUpperCase()}] ${scope ? `(${scope}) ` : ''}${msg}`;
  if (meta && Object.keys(meta).length > 0) {
    try {
      return `${base} ${JSON.stringify(meta)}`;
    } catch (_) {
      return base;
    }
  }
  return base;
};

const emit = (level, scope, msg, meta) => {
  if (LEVELS[level] < threshold) return;
  const line = fmt(level, scope, msg, meta);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  if (fileStream) fileStream.write(line + '\n');
};

const make = (scope) => ({
  debug: (msg, meta) => emit('debug', scope, msg, meta),
  info: (msg, meta) => emit('info', scope, msg, meta),
  warn: (msg, meta) => emit('warn', scope, msg, meta),
  error: (msg, meta) => emit('error', scope, msg, meta),
});

const logger = make('');
logger.scoped = make;

module.exports = logger;
