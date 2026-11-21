import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import config from './config/index.js';
import { connectDB, closeDB } from './db/index.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use('/api', apiRoutes);

// Serve the built React app; any other path returns index.html so React Router can handle it.
const dist = path.join(import.meta.dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

/** Connect everything the app needs before it can serve requests. */
export async function initApp() {
  await connectDB(config.mongoUrl);
}

/** Release the app's resources (DB connection) on shutdown. */
export async function closeApp() {
  await closeDB();
}

export default app;
