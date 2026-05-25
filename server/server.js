'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Server } = require('socket.io');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const diagnostics = require('./src/utils/diagnostics');
const { initializeDatabase } = require('./src/db');
const socketBus = require('./src/socket');

// Run startup diagnostics BEFORE we try to mount anything. Prints every check
// to the console so the user can see exactly what's wrong if the server fails.
const DIAG = diagnostics.run();

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

const mountResults = [];
const mountFeature = (mountPath, routePath) => {
  try {
    app.use(mountPath, require(routePath));
    mountResults.push({ mountPath, ok: true });
    logger.info(`mounted ${mountPath}`);
  } catch (err) {
    mountResults.push({ mountPath, ok: false, error: err.message });
    diagnostics.banner(`!! FAILED to mount ${mountPath}`);
    console.error(`  Route file: ${routePath}`);
    console.error(`  Error code: ${err.code || 'n/a'}`);
    console.error(`  Message:    ${err.message}`);
    if (err.url) console.error(`  URL:        ${err.url}`);
    if (err.stack) {
      console.error('  Stack:');
      err.stack.split('\n').slice(0, 8).forEach((l) => console.error(`    ${l}`));
    }
    console.error('');
    logger.error(`failed to mount ${mountPath}: ${err.message}`, { code: err.code });
  }
};
mountFeature('/api/profiles', './src/features/profiles/routes');
mountFeature('/api/friends',  './src/features/friends/routes');
mountFeature('/api/cs2',      './src/features/cs2/routes');
mountFeature('/api/prices',   './src/features/prices/routes');
mountFeature('/api/proxies',  './src/features/proxies/routes');

const mountFailed = mountResults.filter((r) => !r.ok);
if (mountFailed.length > 0) {
  diagnostics.banner('Route mount summary');
  console.log(`  ${mountFailed.length}/${mountResults.length} route module(s) FAILED to load.`);
  console.log(`  Failed: ${mountFailed.map((f) => f.mountPath).join(', ')}`);
  console.log('  -> All endpoints under those prefixes will return 404 until fixed.');
  console.log('  -> Scroll up to "Startup diagnostics" section for the root cause.');
  console.log('');
} else {
  logger.info(`all ${mountResults.length} feature routes mounted successfully`);
}

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
