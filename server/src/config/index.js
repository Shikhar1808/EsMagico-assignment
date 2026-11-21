import os from 'node:os';

export default {
  port: Number(process.env.PORT) || 8080,
  // Worker processes for clustering; WEB_CONCURRENCY=1 runs a single process (no cluster).
  workers: Number(process.env.WEB_CONCURRENCY) || os.availableParallelism(),
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/results_portal',
  maxUploadMb: 10,
};
