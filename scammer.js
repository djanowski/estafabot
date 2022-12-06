import mongoose from 'mongoose';

const scammerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  lastTweetID: { type: String },
});

scammerSchema.statics.findByUsername = async function findByUsername(username) {
  const scammers = await this.find().lean();
  return scammers.find(
    scammer => scammer.username.toLowerCase() === username.toLowerCase()
  );
};

const Scammer = mongoose.model('Scammer', scammerSchema);

export default Scammer;
