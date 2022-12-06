import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true },
  victim: {
    user: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      createdAt: { type: Date, required: true },
    },
    tweet: {
      id: { type: String },
      text: { type: String },
      createdAt: { type: Date },
    },
  },
  scammer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scammer',
    required: true,
  },
  tweet: {
    id: { type: String, required: true },
    text: { type: String },
    createdAt: { type: Date },
  },
});

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
