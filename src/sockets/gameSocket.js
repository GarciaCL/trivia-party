import { GameState } from '../state/gameState.js';
import { ContentData } from '../state/contentData.js';

export function initGameSockets(io) {
  io.on('connection', (socket) => {
    socket.emit('state:sync', GameState.getPublicState());

    // 1. Unirse validando el PIN de sala de 4 dígitos
    socket.on('team:join', ({ name, pin }) => {
      const cleanPin = String(pin || '').trim();
      if (cleanPin !== GameState.roomPin) {
        return socket.emit('join:error', { message: 'PIN de sala incorrecto. Revisa el código en la TV.' });
      }
      if (!name || !name.trim()) {
        return socket.emit('join:error', { message: 'Escribe un nombre para tu grupo.' });
      }
      const team = GameState.addTeam(socket.id, name);
      socket.emit('join:success', { team, state: GameState.getPublicState() });
      io.emit('state:sync', GameState.getPublicState());
    });

    // 2. Votar por el equipo que será Anfitrión
    socket.on('lobby:vote_host', ({ targetTeamId }) => {
      if (GameState.phase !== 'lobby') return;
      GameState.castHostVote(socket.id, targetTeamId);
      io.emit('state:sync', GameState.getPublicState());
    });

    // 3. El Anfitrión actualiza modalidad o categoría (se refleja en vivo en TV y celulares)
    socket.on('host:update_config', ({ mode, category }) => {
      if (socket.id !== GameState.hostTeamId) return;
      if (mode) GameState.mode = mode;
      if (category) GameState.category = category;
      io.emit('state:sync', GameState.getPublicState());
    });

    // 4. Iniciar o pasar a la siguiente ronda (solo Anfitrión o TV)
    const triggerNextRound = async (categoryOverride) => {
      const cat = categoryOverride || GameState.category || 'all';
      const item = await ContentData.getRandomItem(cat);
      if (!item) return;
      GameState.startNewRound(item);
      io.emit('state:sync', GameState.getPublicState());
      io.emit('round:new', {
        item: {
          id: item._id,
          youtubeId: item.youtubeId,
          startSec: item.startSec,
          type: item.type,
          title: item.title
        },
        mode: GameState.mode,
        hostTeamId: GameState.hostTeamId
      });
      io.emit('round:options', { options: item.options });
    };

    socket.on('host:next_round', async ({ category } = {}) => {
      // Permitir si viene de la TV (no está en teams) o del Anfitrión elegido
      const isTv = !GameState.teams[socket.id];
      if (!isTv && socket.id !== GameState.hostTeamId) return;
      await triggerNextRound(category);
    });

    // 5. Buzzer: estrictamente ignorado si phase !== 'playing' o si no hay ronda activa
    socket.on('team:buzz', () => {
      if (GameState.phase !== 'playing' || !GameState.currentItem) return;
      if (!GameState.teams[socket.id]) return;
      if (GameState.lockedTeams.includes(socket.id)) return;

      // En modo 'host' (Con Presentador), el anfitrión arbitra y no se auto-toca el timbre
      if (GameState.mode === 'host' && socket.id === GameState.hostTeamId) return;

      GameState.phase = 'buzzed';
      GameState.buzzedTeamId = socket.id;
      io.emit('state:sync', GameState.getPublicState());
      io.emit('round:buzzed', {
        team: GameState.teams[socket.id],
        mode: GameState.mode
      });
    });

    // 6. Respuesta en Modo Automático (Todos Juegan)
    socket.on('team:answer', ({ optionIndex }) => {
      if (GameState.phase !== 'buzzed' || socket.id !== GameState.buzzedTeamId) return;
      const item = GameState.currentItem;
      const isCorrect = Number(optionIndex) === Number(item.correctIndex);

      if (isCorrect) {
        GameState.teams[socket.id].score += 100;
        GameState.phase = 'result';
        io.emit('state:sync', GameState.getPublicState());
        io.emit('round:result', {
          correct: true,
          team: GameState.teams[socket.id],
          item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec }
        });
      } else {
        GameState.lockedTeams.push(socket.id);
        const totalEligible = Object.keys(GameState.teams).length;
        if (GameState.lockedTeams.length >= totalEligible) {
          GameState.phase = 'result';
          io.emit('state:sync', GameState.getPublicState());
          io.emit('round:result', {
            correct: false,
            steal: false,
            team: GameState.teams[socket.id],
            item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec }
          });
        } else {
          // Robo de turno abierto para los demás equipos
          GameState.phase = 'playing';
          GameState.buzzedTeamId = null;
          io.emit('state:sync', GameState.getPublicState());
          io.emit('round:steal', {
            failedTeam: GameState.teams[socket.id],
            lockedTeams: GameState.lockedTeams
          });
        }
      }
    });

    // 7. Arbitraje manual del Anfitrión (Modo Presentador)
    socket.on('host:judge', ({ isCorrect }) => {
      if (socket.id !== GameState.hostTeamId && GameState.teams[socket.id]) return;
      if (GameState.phase !== 'buzzed' || !GameState.buzzedTeamId) return;
      const team = GameState.teams[GameState.buzzedTeamId];
      const item = GameState.currentItem;

      if (isCorrect) {
        team.score += 100;
        GameState.phase = 'result';
        io.emit('state:sync', GameState.getPublicState());
        io.emit('round:result', {
          correct: true,
          team,
          item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec }
        });
      } else {
        GameState.lockedTeams.push(team.id);
        GameState.phase = 'playing';
        GameState.buzzedTeamId = null;
        io.emit('state:sync', GameState.getPublicState());
        io.emit('round:steal', {
          failedTeam: team,
          lockedTeams: GameState.lockedTeams
        });
      }
    });

    // 8. Finalizar partida y mostrar podio
    socket.on('host:end_game', () => {
      if (socket.id !== GameState.hostTeamId && GameState.teams[socket.id]) return;
      GameState.phase = 'podium';
      const ranking = Object.values(GameState.teams).sort((a, b) => b.score - a.score);
      io.emit('state:sync', GameState.getPublicState());
      io.emit('game:podium', { ranking });
    });

    socket.on('disconnect', () => {
      if (GameState.teams[socket.id]) {
        GameState.removeTeam(socket.id);
        io.emit('state:sync', GameState.getPublicState());
      }
    });
  });
}