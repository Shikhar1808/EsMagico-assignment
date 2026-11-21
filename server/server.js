// Process concerns only: clustering, starting, shutdown and crash handling.
// The app itself (routes, DB connection) lives in src/app.js.
import cluster from 'node:cluster';
import http from 'node:http';
import config from './src/config/index.js';
import app, { initApp, closeApp } from './src/app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const RESPAWN_DELAY_MS = 2_000;

if (cluster.isPrimary && config.workers > 1) startPrimary();
else startWorker();

/** Primary: fork one worker per CPU, replace any that crash, stop them all on shutdown. */
function startPrimary() {
  console.log(`Primary ${process.pid}: starting ${config.workers} workers`);
  for (let i = 0; i < config.workers; i++) cluster.fork();

  let shuttingDown = false;
  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) {
      if (Object.keys(cluster.workers).length === 0) process.exit(0);
      return;
    }
    console.error(`Worker ${worker.process.pid} exited (${signal || code}); starting a replacement.`);
    // Delay so a worker that can't start (e.g. DB down) retries calmly instead of in a tight loop.
    setTimeout(() => cluster.fork(), RESPAWN_DELAY_MS);
  });

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Primary: ${signal} received, stopping workers.`);
    for (const worker of Object.values(cluster.workers)) worker.process.kill('SIGTERM');
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/** Worker (or the only process): connect the app, serve HTTP, shut down cleanly. */
async function startWorker() {
  try {
    await initApp();
  } catch (e) {
    console.error(`Worker ${process.pid} failed to start:`, e.message);
    process.exit(1);
  }

  const server = http.createServer(app).listen(config.port, () =>
    console.log(`Worker ${process.pid}: results portal on http://localhost:${config.port}`),
  );

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Worker ${process.pid}: ${signal} received, finishing in-flight requests.`);
    server.close(async () => {
      await closeApp();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref(); // don't hang on a stuck request
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // A promise nobody awaited: log it loudly but keep serving (request errors are already handled).
  process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));
  // State after an uncaught exception is unknown: log and exit; the primary (or Docker) starts a new one.
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception, exiting:', err);
    process.exit(1);
  });
}
