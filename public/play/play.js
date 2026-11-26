const socket = io();

let myTeam = null;
let currentState = null;

// Autocompletar PIN si viene desde el código QR (/play?pin=1234)
const urlParams = new URLSearchParams(window.location.search);
const inputPin = document.getElementById('input-room-pin');
if (urlParams.get('pin')) {
  inputPin.value = urlParams.get('pin');
}

const screenJoin = document.getElementById('screen-join');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');

const viewBuzzer = document.getElementById('view-buzzer');
const viewOptions = document.getElementById('view-options');
const viewStatus = document.getElementById('view-status');
const btnBuzzer = document.getElementById('btn-buzzer');
const buzzerHint = document.getElementById('buzzer-hint');

function showScreen(screen) {
  [screenJoin, screenLobby, screenGame].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function showGameView(view) {
  [viewBuzzer, viewOptions, viewStatus].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

function setBuzzerEnabled(enabled, label = '¡ME LA SÉ!', hint = 'Toca apenas reconozcas el tema') {
  btnBuzzer.disabled = !enabled;
  btnBuzzer.style.opacity = enabled ? '1' : '0.4';
  btnBuzzer.style.cursor = enabled ? 'pointer' : 'not-allowed';
  btnBuzzer.querySelector('span').textContent = label;
  buzzerHint.textContent = hint;
}

function renderHostToggleButtons(state) {
  document.querySelectorAll('#host-mode-group .host-toggle-btn').forEach(btn => {
    const isSelected = btn.dataset.mode === state.mode;
    btn.style.background = isSelected ? '#00f0ff' : 'rgba(255,255,255,0.08)';
    btn.style.color = isSelected ? '#0d0221' : '#fff';
    btn.style.border = isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.18)';
    btn.style.opacity = isSelected ? '1' : '0.45';
    btn.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
  });

  document.querySelectorAll('#host-cat-group .host-toggle-btn').forEach(btn => {
    const isSelected = btn.dataset.cat === state.category;
    btn.style.background = isSelected ? '#ff007f' : 'rgba(255,255,255,0.08)';
    btn.style.color = '#fff';
    btn.style.border = isSelected ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.18)';
    btn.style.opacity = isSelected ? '1' : '0.45';
    btn.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
  });
}

// 1. Unirse con PIN + Nombre
document.getElementById('btn-join').addEventListener('click', () => {
  const pin = inputPin.value.trim();
  const name = document.getElementById('input-team-name').value.trim();
  document.getElementById('join-error-msg').textContent = '';
  socket.emit('team:join', { pin, name });
});

socket.on('join:error', ({ message }) => {
  document.getElementById('join-error-msg').textContent = message;
});

socket.on('join:success', ({ team, state }) => {
  myTeam = team;
  document.getElementById('lobby-team-badge').textContent = team.name;
  document.getElementById('lobby-pin-badge').textContent = `PIN: ${state.roomPin}`;
  document.getElementById('header-team-name').textContent = team.name;
  setBuzzerEnabled(false, 'ESPERA...', 'Esperando que inicie la ronda en la TV...');
  showScreen(screenLobby);
  syncUI(state);
});

// 2. Sincronización de estado (Lobby, Votos, Anfitrión, Puntajes)
function syncUI(state) {
  currentState = state;
  if (!myTeam) return;

  const updatedMe = state.teams.find(t => t.id === myTeam.id);
  if (updatedMe) {
    myTeam = updatedMe;
    document.getElementById('header-team-score').textContent = `${myTeam.score} pts`;
  }

  const amIHost = state.hostTeamId === myTeam.id;

  // Renderizar votación en Lobby
  if (state.phase === 'lobby') {
    showScreen(screenLobby);
    const voteList = document.getElementById('host-vote-list');
    voteList.innerHTML = state.teams.map(t => {
      const votes = state.hostVotesTally?.[t.id] || 0;
      const isChosen = state.hostTeamId === t.id;
      return `
        <button type="button" onclick="voteForHost('${t.id}')" class="btn"
          style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:10px 14px;
          background:${isChosen ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.08)'};
          border:1px solid ${isChosen ? '#ffd700' : 'rgba(255,255,255,0.15)'}; color:#fff;">
          <span>${isChosen ? '👑 ' : ''}${t.name}</span>
          <span style="font-size:0.82rem; color:#00f0ff;">${votes} voto(s)</span>
        </button>
      `;
    }).join('');

    const chosenTeam = state.teams.find(t => t.id === state.hostTeamId);
    document.getElementById('host-chosen-banner').textContent = chosenTeam
      ? `👑 Anfitrión elegido: ${chosenTeam.name}`
      : 'Toca un grupo para votar quién controla la partida';

    // Mostrar configuración SOLO al Anfitrión elegido
    const hostSetup = document.getElementById('host-setup-card');
    if (amIHost) {
      hostSetup.classList.remove('hidden');
      renderHostToggleButtons(state);
    } else {
      hostSetup.classList.add('hidden');
    }
  } else {
    showScreen(screenGame);
    // Mostrar barra de control SOLO al Anfitrión elegido
    const liveControls = document.getElementById('host-live-controls');
    if (amIHost) {
      liveControls.classList.remove('hidden');
    } else {
      liveControls.classList.add('hidden');
    }
  }
}

window.voteForHost = (targetTeamId) => {
  socket.emit('lobby:vote_host', { targetTeamId });
};

// Cambios de configuración del Anfitrión con botones táctiles
document.querySelectorAll('#host-mode-group .host-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('host:update_config', { mode: btn.dataset.mode });
  });
});

document.querySelectorAll('#host-cat-group .host-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('host:update_config', { category: btn.dataset.cat });
  });
});

document.getElementById('btn-host-start-game').addEventListener('click', () => {
  socket.emit('host:next_round', {});
});

// Botones del Anfitrión durante la partida
document.getElementById('btn-host-next-round').addEventListener('click', () => {
  socket.emit('host:next_round', {});
});

document.getElementById('btn-host-end-game').addEventListener('click', () => {
  socket.emit('host:end_game');
});

document.getElementById('btn-judge-ok').addEventListener('click', () => {
  socket.emit('host:judge', { isCorrect: true });
});

document.getElementById('btn-judge-fail').addEventListener('click', () => {
  socket.emit('host:judge', { isCorrect: false });
});

socket.on('state:sync', syncUI);

// 3. Nueva Ronda: AHORA sí se habilita el botón ¡ME LA SÉ!
socket.on('round:new', ({ mode, hostTeamId }) => {
  showScreen(screenGame);
  document.getElementById('host-judge-row').classList.add('hidden');

  if (mode === 'host' && myTeam?.id === hostTeamId) {
    // En modo Presentador, el anfitrión dirige y no responde
    document.getElementById('status-icon').textContent = '🎤';
    document.getElementById('status-title').textContent = 'Eres el Presentador';
    document.getElementById('status-desc').textContent = 'Espera a que un grupo toque su timbre para validar su respuesta.';
    showGameView(viewStatus);
    return;
  }

  setBuzzerEnabled(true, '¡ME LA SÉ!', 'Toca apenas reconozcas el tema');
  showGameView(viewBuzzer);
});

socket.on('round:options', ({ options }) => {
  const btns = document.querySelectorAll('#options-grid .option-btn');
  options.forEach((text, idx) => {
    if (btns[idx]) btns[idx].textContent = text;
  });
});

// Pulsar Buzzer (solo funciona si está habilitado en ronda activa)
btnBuzzer.addEventListener('click', () => {
  if (btnBuzzer.disabled) return;
  setBuzzerEnabled(false, 'ENVIANDO...', 'Conectando con la TV...');
  socket.emit('team:buzz');
});

socket.on('round:buzzed', ({ team, mode }) => {
  if (myTeam && team.id === myTeam.id) {
    if (mode === 'host') {
      document.getElementById('status-icon').textContent = '🗣️';
      document.getElementById('status-title').textContent = '¡DI LA RESPUESTA EN VOZ ALTA!';
      document.getElementById('status-desc').textContent = 'El presentador validará si acertaste.';
      showGameView(viewStatus);
    } else {
      showGameView(viewOptions);
    }
  } else {
    // Si soy el presentador en modo 'host', muestro botones ✅ / ❌
    if (mode === 'host' && myTeam?.id === currentState?.hostTeamId) {
      document.getElementById('host-judge-row').classList.remove('hidden');
      document.getElementById('status-icon').textContent = '🔔';
      document.getElementById('status-title').textContent = `Responde: ${team.name}`;
      document.getElementById('status-desc').textContent = 'Usa los botones de arriba para aprobar o rechazar.';
      showGameView(viewStatus);
    } else {
      document.getElementById('status-icon').textContent = '⚡';
      document.getElementById('status-title').textContent = `${team.name} tocó primero`;
      document.getElementById('status-desc').textContent = 'Prepárate por si fallan...';
      showGameView(viewStatus);
    }
  }
});

// Selección de respuesta en Modo Automático
document.querySelectorAll('#options-grid .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.index);
    socket.emit('team:answer', { optionIndex: idx });
    document.getElementById('status-icon').textContent = '⏳';
    document.getElementById('status-title').textContent = 'Respuesta enviada';
    document.getElementById('status-desc').textContent = 'Verificando...';
    showGameView(viewStatus);
  });
});

// Robo de turno abierto
socket.on('round:steal', ({ failedTeam, lockedTeams }) => {
  document.getElementById('host-judge-row').classList.add('hidden');
  if (myTeam && lockedTeams.includes(myTeam.id)) {
    document.getElementById('status-icon').textContent = '❌';
    document.getElementById('status-title').textContent = '¡Fallaste!';
    document.getElementById('status-desc').textContent = 'Los demás equipos tienen oportunidad de robar.';
    showGameView(viewStatus);
  } else if (currentState?.mode === 'host' && myTeam?.id === currentState?.hostTeamId) {
    document.getElementById('status-title').textContent = `¡${failedTeam.name} falló! Robo abierto`;
    showGameView(viewStatus);
  } else {
    setBuzzerEnabled(true, '¡ROBO DE TURNO!', `¡${failedTeam.name} falló! Toca rápido`);
    showGameView(viewBuzzer);
  }
});

// Resultado de la ronda (deshabilita el Buzzer hasta que el Anfitrión pulse Siguiente Ronda)
socket.on('round:result', ({ correct, team, item }) => {
  document.getElementById('host-judge-row').classList.add('hidden');
  setBuzzerEnabled(false, 'FIN DE RONDA', 'Esperando que el anfitrión inicie la siguiente ronda...');
  document.getElementById('status-icon').textContent = correct ? '🎉' : '😢';
  document.getElementById('status-title').textContent = correct
    ? `¡Punto para ${team.name}!`
    : 'Nadie acertó esta ronda';
  document.getElementById('status-desc').textContent = `Era: ${item.title}`;
  showGameView(viewStatus);
});

socket.on('game:podium', ({ ranking }) => {
  const pos = ranking.findIndex(t => t.id === myTeam?.id) + 1;
  document.getElementById('status-icon').textContent = pos === 1 ? '🏆' : '🎊';
  document.getElementById('status-title').textContent = pos > 0 ? `Terminaste en el puesto #${pos}` : '¡Juego Terminado!';
  document.getElementById('status-desc').textContent = 'Mira el podio en la pantalla principal.';
  showGameView(viewStatus);
});