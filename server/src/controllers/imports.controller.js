import { importCsv } from '../services/import.service.js';

export async function create(req, res) {
  const summary = await importCsv(req.file.buffer, req.file.originalname);
  res.json(summary);
}

