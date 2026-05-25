'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Server } = require('socket.io');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { initializeDatabase } = require('./src/db');
const socketBus = require('./src/socket');

const healthRoutes = require('./src/features/health/routes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: config.clientUrl, methods: ['GET', 'POST'] },
});
app.set('io', io);

app.use(compression());
app.use(cors({
  origin: config.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - t;
    const lvl = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
    logger[lvl](`${req.method} ${req.originalUrl} -> ${res.statusCode} (${dur}ms)`);
  });
  next();
});

app.get('/', (_req, res) => res.json({ message: 'Steam Profile App API' }));
app.use('/api/health', healthRoutes);
app.get('/health', (_req, res) => res.redirect(301, '/api/health'));

try {
  app.use('/api/profiles', require('./src/features/profiles/routes'));
} catch (_) { /* not yet implemented */ }
try {
  app.use('/api/friends', require('./src/features/friends/routes'));
} catch (_) { /* not yet implemented */ }
try {
  app.use('/api/cs2', require('./src/features/cs2/routes'));
} catch (_) { /* not yet implemented */ }
try {
  app.use('/api/prices', require('./src/features/prices/routes'));
} catch (_) { /* not yet implemented */ }
try {
  app.use('/api/proxies', require('./src/features/proxies/routes'));
} catch (_) { /* not yet implemented */ }

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err.proxyError) {
    logger.warn(`proxy error: ${err.userMessage}`);
    return res.status(502).json({ error: err.userMessage, kind: 'proxy' });
  }
  const upstreamStatus = err.response?.status;
  if (upstreamStatus) {
    logger.warn(`upstream ${upstreamStatus}: ${err.message}`);
    return res.status(502).json({ error: `Upstream Steam request failed (${upstreamStatus})`, kind: 'upstream' });
  }
  logger.error(`unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const start = async () => {
  try {
    await initializeDatabase();
    socketBus.init(io);
    server.listen(config.port, () => {
      logger.info(`server listening on :${config.port}`, {
        env: config.env,
        client: config.clientUrl,
        steamApi: config.steamApiKey ? 'configured' : 'missing',
      });
    });
  } catch (err) {
    logger.error('startup failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

const shutdown = (sig) => {
  logger.warn(`${sig} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
