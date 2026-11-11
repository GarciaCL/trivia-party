import * as GameState from '../state/gameState.js';

function shuffleOptions(item) {
  const all = [item.correctAnswer, item.trapAnswer, ...item.distractors];
  return all.sort(() => Math.random() - 0.5);
}

export function initGameSockets(io) {
  io.on('connection', (socket) => {
    // 1. Registro de equipo desde el móvil
    socket.on('team:join', ({ name }) => {
      const team = GameState.registerTeam(socket.id, name);
      socket.emit('team:joined', { team, state: GameState.state });
      io.emit('teams:updated', GameState.getTeamsList());
    });

    // 2. Un equipo presiona el buzzer ("¡ME LA SÉ!")
    socket.on('buzzer:press', () => {
      const claimed = GameState.tryClaimBuzzer(socket.id);
      if (!claimed) return;

      const team = GameState.state.teams.get(socket.id);
      const currentItem = GameState.getCurrentItem();

      io.emit('buzzer:locked', { teamId: socket.id, teamName: team.name });

      if (GameState.state.gameMode === 'auto' && currentItem) {
        const options = shuffleOptions(currentItem);
        socket.emit('round:options', { options, timeLimit: 5 });
      }
    });

    // 3. Respuesta enviada desde el móvil
    socket.on('round:answer', ({ answer }) => {
      if (GameState.state.buzzerLockedBy !== socket.id) return;

      const currentItem = GameState.getCurrentItem();
      const isCorrect = answer === currentItem.correctAnswer;
      const delta = isCorrect ? 10 : -10;
      const updatedTeam = GameState.updateScore(socket.id, delta);

      GameState.releaseBuzzer();
      io.emit('teams:updated', GameState.getTeamsList());

      if (isCorrect) {
        io.emit('round:success', { team: updatedTeam, chorusSec: currentItem.chorusSec });
      } else {
        io.emit('round:fail', { team: updatedTeam, answerSubmitted: answer });
      }
    });

    // 4. Decisiones del árbitro (Modo Presentador)
    socket.on('host:judge', ({ action, bonus = 0 }) => {
      const lockedId = GameState.state.buzzerLockedBy;
      if (!lockedId) return;

      const currentItem = GameState.getCurrentItem();
      const delta = action === 'correct' ? (10 + bonus) : -10;
      const updatedTeam = GameState.updateScore(lockedId, delta);

      GameState.releaseBuzzer();
      io.emit('teams:updated', GameState.getTeamsList());

      if (action === 'correct') {
        io.emit('round:success', { team: updatedTeam, chorusSec: currentItem.chorusSec });
      } else {
        io.emit('round:fail', { team: updatedTeam });
      }
    });

    // 5. Controles de sala y siguiente ronda
    socket.on('host:next_round', () => {
      const nextItem = GameState.nextRound();
      io.emit('round:new', { item: nextItem });
    });

    // 6. Gestión Super Admin (Añadir, eliminar y listar contenido)
    socket.on('admin:get_items', () => {
      socket.emit('admin:items_list', GameState.state.items);
    });

    socket.on('admin:add_item', (newItem) => {
      GameState.state.items.push(newItem);
      io.emit('admin:items_list', GameState.state.items);
    });

    socket.on('admin:delete_item', ({ id }) => {
      GameState.state.items = GameState.state.items.filter((it) => it.id !== id);
      io.emit('admin:items_list', GameState.state.items);
    });

    // Desconexión de equipo
    socket.on('disconnect', () => {
      GameState.removeTeam(socket.id);
      io.emit('teams:updated', GameState.getTeamsList());
    });
  });
}