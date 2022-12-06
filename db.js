import mongoose from 'mongoose';

let connected = false;

export default async function connect() {
  if (connected) return;

  connected = true;

  const connection = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  connection.connection.on('error', error => {
    console.error(error);
  });

  console.log(`MongoDB Connected: ${connection.connection.host}`);
}
