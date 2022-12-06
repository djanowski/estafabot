import mongoose from 'mongoose';

const scammerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  lastTweetID: { type: String },
});

const Scammer = mongoose.model('Scammer', scammerSchema);

export default Scammer;
