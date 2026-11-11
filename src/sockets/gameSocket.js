import { GameState } from '../state/gameState.js';
import { ContentData } from '../state/contentData.js';

export function initGameSockets(io) {
  io.on('connection', (socket) => {
    socket.emit('teams:updated', GameState.state.teams);

    socket.on('team:join', ({ teamName }) => {
      const team = GameState.addTeam(socket.id, teamName);
      socket.emit('team:joined', team);
      io.emit('teams:updated', GameState.state.teams);
    });

    socket.on('host:toggle_mode', ({ mode }) => {
      GameState.state.gameMode = mode;
      io.emit('game:mode_changed', { mode });
    });

    socket.on('host:next_round', () => {
      const item = ContentData.getRandomItem();
      if (!item) return;
      GameState.startNewRound(item);
      io.emit('round:new', {
        item: { id: item.id, youtubeId: item.youtubeId, startSec: item.startSec, type: item.type, title: item.title }
      });
      io.emit('round:options', { options: item.options });
    });

    socket.on('buzzer:press', () => {
      const lockedTeam = GameState.lockBuzzer(socket.id);
      if (lockedTeam) {
        io.emit('buzzer:locked', {
          teamId: lockedTeam.id,
          teamName: lockedTeam.name,
          mode: GameState.state.gameMode
        });
      }
    });

    socket.on('host:judge', ({ action, bonus = 0 }) => {
      const lockedTeam = GameState.state.lockedBy;
      if (!lockedTeam) return;

      if (action === 'correct') {
        GameState.updateScore(lockedTeam.id, 10 + bonus);
        io.emit('round:success', {
          team: lockedTeam,
          chorusSec: GameState.state.currentItem?.chorusSec || 0
        });
        GameState.releaseBuzzer();
      } else {
        GameState.updateScore(lockedTeam.id, -10);
        GameState.registerFail(lockedTeam.id);
        io.emit('round:fail', {
          team: lockedTeam,
          failedTeamId: lockedTeam.id,
          attemptedTeams: GameState.state.attemptedTeams
        });
      }
      io.emit('teams:updated', GameState.state.teams);
    });

    socket.on('player:answer', ({ answerIndex }) => {
      const lockedTeam = GameState.state.lockedBy;
      if (!lockedTeam || lockedTeam.id !== socket.id) return;

      const isCorrect = answerIndex === GameState.state.currentItem.correctIndex;
      if (isCorrect) {
        GameState.updateScore(lockedTeam.id, 10);
        io.emit('round:success', {
          team: lockedTeam,
          chorusSec: GameState.state.currentItem.chorusSec
        });
        GameState.releaseBuzzer();
      } else {
        GameState.updateScore(lockedTeam.id, -10);
        GameState.registerFail(lockedTeam.id);
        io.emit('round:fail', {
          team: lockedTeam,
          failedTeamId: lockedTeam.id,
          attemptedTeams: GameState.state.attemptedTeams
        });
      }
      io.emit('teams:updated', GameState.state.teams);
    });

    socket.on('disconnect', () => {
      GameState.removeTeam(socket.id);
      io.emit('teams:updated', GameState.state.teams);
    });
  });
}