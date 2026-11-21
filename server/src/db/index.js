import mongoose from 'mongoose';
import Student from '../models/Student.js';

// Without buffering, a query while MongoDB is unreachable fails within serverSelectionTimeoutMS
// (-> 503) instead of waiting in Mongoose's queue.
mongoose.set('bufferCommands', false);

export async function connectDB(url) {
  // Fail fast (5 s, default 30 s) so a DB outage becomes a quick 503 instead of a hung request.
  await mongoose.connect(url, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  await Student.createIndexes(); // explicit, so startup fails loudly if an index can't be built
}

export async function closeDB() {
  await mongoose.disconnect();
}
