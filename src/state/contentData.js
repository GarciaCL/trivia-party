// Lista inicial de canciones y escenas para Trivia Party
export const initialItems = [
    // MODO MÚSICA
    {
      id: 'song-1',
      type: 'music',
      title: 'Queen - Bohemian Rhapsody',
      youtubeId: 'fJ9rUzIMcZQ',
      startSec: 48,
      chorusSec: 187,
      correctAnswer: 'Bohemian Rhapsody',
      trapAnswer: 'Mama, Just Killed a Man', // Opción trampa típica de la letra
      distractors: ['We Are the Champions', 'Somebody to Love']
    },
    {
      id: 'song-2',
      type: 'music',
      title: 'Michael Jackson - Billie Jean',
      youtubeId: 'Zi_XLORVo',
      startSec: 12,
      chorusSec: 88,
      correctAnswer: 'Billie Jean',
      trapAnswer: 'The Kid Is Not My Son', // Opción trampa
      distractors: ['Beat It', 'Smooth Criminal']
    },
    {
      id: 'song-3',
      type: 'music',
      title: 'Luis Fonsi - Despacito',
      youtubeId: 'kJQP7kiw5Fk',
      startSec: 15,
      chorusSec: 72,
      correctAnswer: 'Despacito',
      trapAnswer: 'Pasito a Pasito', // Opción trampa
      distractors: ['Échame la Culpa', 'Bailando']
    },
  
    // MODO PELÍCULAS / SERIES
    {
      id: 'movie-1',
      type: 'movie',
      title: 'Star Wars: Episodio V',
      youtubeId: '_lOT2p_FCvA',
      startSec: 25,
      chorusSec: 75,
      correctAnswer: 'Star Wars: El Imperio Contraataca',
      trapAnswer: 'Star Wars: Una Nueva Esperanza', // Confusión con la primera entrega
      distractors: ['Star Wars: El Retorno del Jedi', 'Star Trek: Nemesis'],
      bonusQuestion: '¿Año de estreno?',
      bonusAnswer: '1980'
    },
    {
      id: 'movie-2',
      type: 'movie',
      title: 'Titanic',
      youtubeId: 'kVrqfYjkTdQ',
      startSec: 10,
      chorusSec: 65,
      correctAnswer: 'Titanic',
      trapAnswer: 'El Naufragio Perfecto', // Título falso convincente
      distractors: ['Pearl Harbor', 'Poseidón'],
      bonusQuestion: '¿Director de la película?',
      bonusAnswer: 'James Cameron'
    }
  ];