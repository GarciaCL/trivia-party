import { MongoClient, ObjectId } from 'mongodb';

const DEFAULT_ITEMS = [
  {
    type: 'music', title: 'Gasolina - Daddy Yankee', youtubeId: 'qGKrc3A6HHM',
    startSec: 15, chorusSec: 52,
    options: ['Gasolina - Daddy Yankee', 'Lo Que Pasó - Daddy Yankee', 'Rompe - Daddy Yankee', 'Mayor Que Yo - Baby Ranks'],
    correctIndex: 0
  },
  {
    type: 'music', title: 'De Música Ligera - Soda Stereo', youtubeId: 'oxknV-N46VU',
    startSec: 8, chorusSec: 52,
    options: ['Trátame Suavemente - Soda Stereo', 'Persiana Americana - Soda Stereo', 'De Música Ligera - Soda Stereo', 'Prófugos - Soda Stereo'],
    correctIndex: 2
  },
  {
    type: 'movie', title: 'Star Wars: El Imperio Contraataca', youtubeId: '_lOT2p_FCvA',
    startSec: 20, chorusSec: 100,
    options: ['Star Wars: Una Nueva Esperanza', 'Star Wars: El Retorno del Jedi', 'Star Wars: El Imperio Contraataca', 'Star Wars: La Venganza de los Sith'],
    correctIndex: 2
  },
  {
    type: 'movie', title: 'Jurassic Park', youtubeId: 'gOmfl_A1d_0',
    startSec: 10, chorusSec: 45,
    options: ['Jurassic Park', 'Godzilla', 'King Kong', 'Mundo Jurásico'],
    correctIndex: 0
  }
];

let collection = null;
let memoryItems = DEFAULT_ITEMS.map((item, idx) => ({ _id: `mem_${idx}`, ...item }));

export const ContentData = {
  async init() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.warn('⚠️ MONGO_URI no definida. Usando memoria temporal.');
      return;
    }
    const client = new MongoClient(uri);
    await client.connect();
    collection = client.db('triviaparty').collection('items');
    if ((await collection.countDocuments()) === 0) {
      await collection.insertMany(DEFAULT_ITEMS);
    }
    console.log('✅ Conectado a MongoDB Atlas');
  },

  async getAll() {
    if (!collection) return memoryItems;
    return await collection.find({}).sort({ _id: -1 }).toArray();
  },

  async getRandomItem(filterCategory = 'all') {
    const all = await this.getAll();
    let pool = all;
    if (filterCategory === 'music') pool = all.filter(i => i.type === 'music');
    if (filterCategory === 'movie') pool = all.filter(i => i.type === 'movie');
    if (pool.length === 0) pool = all;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  async addItem(item) {
    if (!collection) {
      const created = { _id: `mem_${Date.now()}`, ...item };
      memoryItems.unshift(created);
      return created;
    }
    const res = await collection.insertOne(item);
    return { _id: res.insertedId, ...item };
  },

  async updateItem(id, updates) {
    if (!collection) {
      const idx = memoryItems.findIndex(i => String(i._id) === id);
      if (idx !== -1) memoryItems[idx] = { ...memoryItems[idx], ...updates };
      return memoryItems[idx];
    }
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  async deleteItem(id) {
    if (!collection) {
      memoryItems = memoryItems.filter(i => String(i._id) !== id);
      return;
    }
    await collection.deleteOne({ _id: new ObjectId(id) });
  }
};