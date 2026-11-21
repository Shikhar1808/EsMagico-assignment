import { getStats } from '../services/stats.service.js';

export async function show(req, res) {
  res.json(await getStats());
}
