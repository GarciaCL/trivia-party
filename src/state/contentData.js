export const ContentData = {
  items: [
    // --- MÚSICA ---
    {
      id: 'm1', type: 'music', title: 'Gasolina - Daddy Yankee', youtubeId: 'qGKrc3A6HHM',
      startSec: 15, chorusSec: 52,
      options: ['Gasolina - Daddy Yankee', 'Lo Que Pasó - Daddy Yankee', 'Rompe - Daddy Yankee', 'Mayor Que Yo - Baby Ranks'],
      correctIndex: 0
    },
    {
      id: 'm2', type: 'music', title: 'Billie Jean - Michael Jackson', youtubeId: 'sOnqjkJTMaA',
      startSec: 10, chorusSec: 42,
      options: ['Beat It - Michael Jackson', 'Billie Jean - Michael Jackson', 'Thriller - Michael Jackson', 'Bad - Michael Jackson'],
      correctIndex: 1
    },
    {
      id: 'm3', type: 'music', title: 'De Música Ligera - Soda Stereo', youtubeId: 'oxknV-N46VU',
      startSec: 8, chorusSec: 52,
      options: ['Trátame Suavemente - Soda Stereo', 'Persiana Americana - Soda Stereo', 'De Música Ligera - Soda Stereo', 'Prófugos - Soda Stereo'],
      correctIndex: 2
    },
    {
      id: 'm4', type: 'music', title: 'Danza Kuduro - Don Omar', youtubeId: '7zp1TbLFPp8',
      startSec: 25, chorusSec: 50,
      options: ['Salió El Sol - Don Omar', 'Taboo - Don Omar', 'Dile - Don Omar', 'Danza Kuduro - Don Omar'],
      correctIndex: 3
    },
    {
      id: 'm5', type: 'music', title: 'Livin on a Prayer - Bon Jovi', youtubeId: 'lDK9QqIzhwk',
      startSec: 22, chorusSec: 84,
      options: ['Livin on a Prayer - Bon Jovi', 'You Give Love a Bad Name - Bon Jovi', 'It is My Life - Bon Jovi', 'Always - Bon Jovi'],
      correctIndex: 0
    },

    // --- CINE / SERIES ---
    {
      id: 'c1', type: 'movie', title: 'Star Wars: El Imperio Contraataca', youtubeId: '_lOT2p_FCvA',
      startSec: 20, chorusSec: 100,
      options: ['Star Wars: Una Nueva Esperanza', 'Star Wars: El Retorno del Jedi', 'Star Wars: El Imperio Contraataca', 'Star Wars: La Venganza de los Sith'],
      correctIndex: 2
    },
    {
      id: 'c2', type: 'movie', title: 'Titanic', youtubeId: '3gK_2XdjOdY',
      startSec: 30, chorusSec: 90,
      options: ['Romeo y Julieta', 'El Gran Gatsby', 'El Diario de Noa', 'Titanic'],
      correctIndex: 3
    },
    {
      id: 'c3', type: 'movie', title: 'Jurassic Park', youtubeId: 'gOmfl_A1d_0',
      startSec: 10, chorusSec: 45,
      options: ['Jurassic Park', 'Godzilla', 'King Kong', 'Mundo Jurásico'],
      correctIndex: 0
    },
    {
      id: 'c4', type: 'movie', title: 'El Padrino', youtubeId: 'HWqKPWO5T4o',
      startSec: 15, chorusSec: 60,
      options: ['Scarface', 'El Padrino', 'Goodfellas', 'Casino'],
      correctIndex: 1
    }
  ],

  getRandomItem(filterCategory = 'all') {
    let pool = this.items;
    if (filterCategory === 'music') pool = this.items.filter(i => i.type === 'music');
    if (filterCategory === 'movie') pool = this.items.filter(i => i.type === 'movie');
    if (pool.length === 0) pool = this.items;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  addItem(item) {
    const newItem = { id: `custom_${Date.now()}`, ...item };
    this.items.push(newItem);
    return newItem;
  }
};