import { findBestMatch } from 'string-similarity';
import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  hasAccount: { type: Boolean },
  id: {
    type: String,
    unique: true,
    required() {
      return this.hasAccount;
    },
  },
  username: {
    type: String,
    required() {
      return this.hasAccount;
    },
  },
  addedAt: { type: Date, required: true, default: Date.now },
});

let brandsCache = null;

brandSchema.statics.findByUsername = async function findByUsername(username) {
  if (!brandsCache) brandsCache = await this.find().lean();

  const exact = brandsCache.find(
    brand => brand.username?.toLowerCase() === username.toLowerCase()
  );

  console.log({ username, exact });
  if (exact) return exact;

  const { bestMatchIndex } = findBestMatch(
    username,
    brandsCache.map(b => b.name)
  );

  if (bestMatchIndex > -1) return brandsCache[bestMatchIndex];

  return null;
};

const Brand = mongoose.model('Brand', brandSchema);

export default Brand;
