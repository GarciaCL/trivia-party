import { GameState } from '../state/gameState.js';
import { ContentData } from '../state/contentData.js';

export function initGameSockets(io) {
  io.on('connection', (socket) => {
    socket.emit('state:sync', GameState.getPublicState());

    socket.on('team:join', ({ name, pin }) => {
      const cleanPin = String(pin || '').trim();
      if (cleanPin !== GameState.roomPin) {
        return socket.emit('join:error', { message: 'PIN de sala incorrecto. Revisa el código en la TV.' });
      }
      if (!name || !name.trim()) {
        return socket.emit('join:error', { message: 'Escribe el nombre de tu equipo.' });
      }
      const team = GameState.addTeam(socket.id, name);
      socket.emit('join:success', { team, state: GameState.getPublicState() });
      io.emit('state:sync', GameState.getPublicState());
    });

    socket.on('lobby:vote_host', ({ targetTeamId }) => {
      if (GameState.phase !== 'lobby') return;
      GameState.castHostVote(socket.id, targetTeamId);
      io.emit('state:sync', GameState.getPublicState());
    });

    socket.on('host:update_config', ({ mode, category }) => {
      const isTv = !GameState.teams[socket.id];
      if (!isTv && socket.id !== GameState.hostTeamId) return;
      if (mode) GameState.mode = mode;
      if (category) GameState.category = category;
      io.emit('state:sync', GameState.getPublicState());
    });

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
      const isTv = !GameState.teams[socket.id];
      if (!isTv && socket.id !== GameState.hostTeamId) return;
      await triggerNextRound(category);
    });

    // Buzzer protegido: solo responde si la ronda está activa ('playing')
    socket.on('team:buzz', () => {
      if (GameState.phase !== 'playing' || !GameState.currentItem) return;
      if (!GameState.teams[socket.id]) return;
      if (GameState.lockedTeams.includes(socket.id)) return;
      if (GameState.mode === 'host' && socket.id === GameState.hostTeamId) return;

      GameState.phase = 'buzzed';
      GameState.buzzedTeamId = socket.id;
      io.emit('state:sync', GameState.getPublicState());
      io.emit('round:buzzed', {
        team: GameState.teams[socket.id],
        mode: GameState.mode
      });
    });

    socket.on('team:answer', ({ optionIndex }) => {
      if (GameState.phase !== 'buzzed' || socket.id !== GameState.buzzedTeamId) return;
      const item = GameState.currentItem;
      const isCorrect = Number(optionIndex) === Number(item.correctIndex);

      if (isCorrect) {
        GameState.teams[socket.id].score += 10;
        GameState.phase = 'result';
        io.emit('state:sync', GameState.getPublicState());
        io.emit('round:result', {
          correct: true,
          team: GameState.teams[socket.id],
          item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec, type: item.type }
        });
      } else {
        GameState.lockedTeams.push(socket.id);
        const totalEligible = Object.keys(GameState.teams).length;
        if (GameState.lockedTeams.length >= totalEligible) {
          GameState.phase = 'result';
          io.emit('state:sync', GameState.getPublicState());
          io.emit('round:result', {
            correct: false,
            team: GameState.teams[socket.id],
            item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec, type: item.type }
          });
        } else {
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

    socket.on('host:judge', ({ isCorrect, bonus }) => {
      const isTv = !GameState.teams[socket.id];
      if (!isTv && socket.id !== GameState.hostTeamId) return;
      if (GameState.phase !== 'buzzed' || !GameState.buzzedTeamId) return;

      const team = GameState.teams[GameState.buzzedTeamId];
      const item = GameState.currentItem;

      if (isCorrect) {
        team.score += bonus ? 15 : 10;
        GameState.phase = 'result';
        io.emit('state:sync', GameState.getPublicState());
        io.emit('round:result', {
          correct: true,
          team,
          item: { title: item.title, youtubeId: item.youtubeId, chorusSec: item.chorusSec, type: item.type }
        });
      } else {
        team.score = Math.max(0, team.score - 10);
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

    socket.on('host:end_game', () => {
      const isTv = !GameState.teams[socket.id];
      if (!isTv && socket.id !== GameState.hostTeamId) return;
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