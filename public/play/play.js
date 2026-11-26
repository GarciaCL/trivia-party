const socket = io();

let myTeam = null;
let currentState = null;
let answerTimer = null;

const urlParams = new URLSearchParams(window.location.search);
const inputPin = document.getElementById('input-room-pin');
if (urlParams.get('pin')) inputPin.value = urlParams.get('pin');

const loginView = document.getElementById('login-view');
const lobbyVoteView = document.getElementById('lobby-vote-view');
const gameView = document.getElementById('game-view');

const buzzerBox = document.getElementById('buzzer-box');
const hostModeBanner = document.getElementById('host-mode-banner');
const lockedBanner = document.getElementById('locked-banner');
const optionsPanel = document.getElementById('options-panel');
const btnBuzzer = document.getElementById('btn-buzzer');
const buzzerHint = document.getElementById('buzzer-hint');

function setMainView(view) {
  [loginView, lobbyVoteView, gameView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

function setGameZone(zone) {
  [buzzerBox, hostModeBanner, lockedBanner, optionsPanel].forEach(z => z.classList.add('hidden'));
  zone.classList.remove('hidden');
}

function setBuzzerState(enabled, text = '¡ME LA SÉ!', hint = '¡Pulsa rápido cuando reconozcas el tema!') {
  btnBuzzer.disabled = !enabled;
  btnBuzzer.style.opacity = enabled ? '1' : '0.4';
  btnBuzzer.style.pointerEvents = enabled ? 'auto' : 'none';
  btnBuzzer.querySelector('.buzzer-text').textContent = text;
  buzzerHint.textContent = hint;
}

function updateHostOptionStyles(state) {
  document.querySelectorAll('#host-mode-btns .host-opt-btn').forEach(btn => {
    const active = btn.dataset.mode === state.mode;
    btn.style.background = active ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.08)';
    btn.style.color = active ? '#0d0221' : '#fff';
    btn.style.opacity = active ? '1' : '0.45';
    btn.style.border = active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)';
  });
  document.querySelectorAll('#host-cat-btns .host-opt-btn').forEach(btn => {
    const active = btn.dataset.cat === state.category;
    btn.style.background = active ? 'var(--neon-pink)' : 'rgba(255,255,255,0.08)';
    btn.style.color = '#fff';
    btn.style.opacity = active ? '1' : '0.45';
    btn.style.border = active ? '2px solid var(--neon-yellow)' : '1px solid rgba(255,255,255,0.15)';
  });
}

document.getElementById('form-join').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('join-error-msg').textContent = '';
  socket.emit('team:join', {
    pin: inputPin.value.trim(),
    name: document.getElementById('input-team-name').value.trim()
  });
});

socket.on('join:error', ({ message }) => {
  document.getElementById('join-error-msg').textContent = message;
});

socket.on('join:success', ({ team, state }) => {
  myTeam = team;
  document.getElementById('lobby-team-display').textContent = team.name;
  document.getElementById('lobby-pin-display').textContent = `PIN: ${state.roomPin}`;
  document.getElementById('player-team-display').textContent = team.name;
  setBuzzerState(false, 'ESPERA...', 'Esperando que inicie la ronda...');
  syncState(state);
});

function syncState(state) {
  currentState = state;
  if (!myTeam) return;

  const me = state.teams.find(t => t.id === myTeam.id);
  if (me) {
    myTeam = me;
    document.getElementById('player-score-display').textContent = `${myTeam.score} pts`;
  }

  const amIHost = state.hostTeamId === myTeam.id;

  if (state.phase === 'lobby') {
    setMainView(lobbyVoteView);
    const voteList = document.getElementById('host-vote-list');
    voteList.innerHTML = state.teams.map(t => {
      const votes = state.hostVotesTally?.[t.id] || 0;
      const chosen = state.hostTeamId === t.id;
      return `
        <button type="button" onclick="castVote('${t.id}')" class="btn"
          style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:10px 14px;
          background:${chosen ? 'rgba(255,215,0,0.22)' : 'rgba(255,255,255,0.08)'};
          border:1px solid ${chosen ? 'var(--neon-yellow)' : 'rgba(255,255,255,0.15)'}; color:#fff;">
          <span>${chosen ? '👑 ' : ''}${t.name}</span>
          <span style="color:var(--neon-cyan); font-size:0.82rem;">${votes} voto(s)</span>
        </button>
      `;
    }).join('');

    const hostTeam = state.teams.find(t => t.id === state.hostTeamId);
    document.getElementById('host-chosen-text').textContent = hostTeam
      ? `👑 Anfitrión elegido: ${hostTeam.name}`
      : 'Toca un equipo para votar al anfitrión';

    const configPanel = document.getElementById('host-config-panel');
    if (amIHost) {
      configPanel.classList.remove('hidden');
      updateHostOptionStyles(state);
    } else {
      configPanel.classList.add('hidden');
    }
  } else {
    setMainView(gameView);
    const liveBar = document.getElementById('host-live-bar');
    if (amIHost) liveBar.classList.remove('hidden');
    else liveBar.classList.add('hidden');
  }
}

window.castVote = (targetTeamId) => socket.emit('lobby:vote_host', { targetTeamId });

document.querySelectorAll('#host-mode-btns .host-opt-btn').forEach(btn => {
  btn.addEventListener('click', () => socket.emit('host:update_config', { mode: btn.dataset.mode }));
});
document.querySelectorAll('#host-cat-btns .host-opt-btn').forEach(btn => {
  btn.addEventListener('click', () => socket.emit('host:update_config', { category: btn.dataset.cat }));
});
document.getElementById('btn-host-start').addEventListener('click', () => socket.emit('host:next_round', {}));
document.getElementById('btn-mobile-next').addEventListener('click', () => socket.emit('host:next_round', {}));
document.getElementById('btn-mobile-end').addEventListener('click', () => socket.emit('host:end_game'));
document.getElementById('btn-mobile-ok').addEventListener('click', () => socket.emit('host:judge', { isCorrect: true }));
document.getElementById('btn-mobile-wrong').addEventListener('click', () => socket.emit('host:judge', { isCorrect: false }));

socket.on('state:sync', syncState);

socket.on('round:new', ({ mode, hostTeamId }) => {
  clearInterval(answerTimer);
  setMainView(gameView);
  document.getElementById('host-judge-controls').classList.add('hidden');

  if (mode === 'host' && myTeam?.id === hostTeamId) {
    document.getElementById('host-banner-title').textContent = '🎤 ERES EL PRESENTADOR';
    document.getElementById('host-banner-sub').textContent = 'Espera a que un grupo toque su timbre.';
    setGameZone(hostModeBanner);
    return;
  }

  setBuzzerState(true, '¡ME LA SÉ!', '¡Pulsa rápido cuando reconozcas el tema!');
  setGameZone(buzzerBox);
});

socket.on('round:options', ({ options }) => {
  const palette = [
    { cls: 'opt-0', bg: '#ff7b00', color: '#0d0221' },
    { cls: 'opt-1', bg: '#00f0ff', color: '#0d0221' },
    { cls: 'opt-2', bg: '#ffd700', color: '#0d0221' },
    { cls: 'opt-3', bg: '#ff2a85', color: '#ffffff' }
  ];
  const grid = document.getElementById('options-grid');
  grid.innerHTML = options.map((text, idx) => {
    const style = palette[idx] || palette[0];
    return `
      <button type="button" class="option-btn ${style.cls}" data-index="${idx}"
        style="background:${style.bg}; color:${style.color}; font-weight:800; border-radius:16px; min-height:115px; padding:14px; font-size:0.95rem; line-height:1.25;">
        ${text}
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      clearInterval(answerTimer);
      socket.emit('team:answer', { optionIndex: Number(btn.dataset.index) });
      document.getElementById('locked-icon').textContent = '⏳';
      document.getElementById('locked-msg').textContent = 'Respuesta enviada';
      document.getElementById('locked-team-name').textContent = 'Verificando...';
      setGameZone(lockedBanner);
    });
  });
});

btnBuzzer.addEventListener('click', () => {
  if (btnBuzzer.disabled) return;
  setBuzzerState(false, 'ENVIANDO...', 'Conectando...');
  socket.emit('team:buzz');
});

function startFiveSecondCountdown() {
  clearInterval(answerTimer);
  let left = 5;
  const countEl = document.getElementById('timer-countdown');
  const progEl = document.getElementById('timer-progress');
  countEl.textContent = `${left}s`;
  progEl.style.width = '100%';

  answerTimer = setInterval(() => {
    left -= 1;
    countEl.textContent = `${Math.max(0, left)}s`;
    progEl.style.width = `${(Math.max(0, left) / 5) * 100}%`;
    if (left <= 0) clearInterval(answerTimer);
  }, 1000);
}

socket.on('round:buzzed', ({ team, mode }) => {
  if (myTeam && team.id === myTeam.id) {
    if (mode === 'host') {
      document.getElementById('host-banner-title').textContent = '¡HABLA EN VOZ ALTA!';
      document.getElementById('host-banner-sub').textContent = 'El presentador está calificando tu respuesta.';
      setGameZone(hostModeBanner);
    } else {
      setGameZone(optionsPanel);
      startFiveSecondCountdown();
    }
  } else {
    if (mode === 'host' && myTeam?.id === currentState?.hostTeamId) {
      document.getElementById('host-judge-controls').classList.remove('hidden');
      document.getElementById('locked-icon').textContent = '🔔';
      document.getElementById('locked-msg').textContent = `Responde: ${team.name}`;
      document.getElementById('locked-team-name').textContent = 'Aprueba o rechaza arriba.';
      setGameZone(lockedBanner);
    } else {
      document.getElementById('locked-icon').textContent = '🔒';
      document.getElementById('locked-msg').textContent = '¡Turno Bloqueado!';
      document.getElementById('locked-team-name').textContent = `${team.name} está respondiendo...`;
      setGameZone(lockedBanner);
    }
  }
});

socket.on('round:steal', ({ failedTeam, lockedTeams }) => {
  document.getElementById('host-judge-controls').classList.add('hidden');
  if (myTeam && lockedTeams.includes(myTeam.id)) {
    document.getElementById('locked-icon').textContent = '❌';
    document.getElementById('locked-msg').textContent = '¡Fallaste!';
    document.getElementById('locked-team-name').textContent = 'Otros equipos pueden robar el turno.';
    setGameZone(lockedBanner);
  } else if (currentState?.mode === 'host' && myTeam?.id === currentState?.hostTeamId) {
    document.getElementById('locked-msg').textContent = `¡${failedTeam.name} falló! Robo abierto`;
    setGameZone(lockedBanner);
  } else {
    setBuzzerState(true, '¡ROBO!', `¡${failedTeam.name} falló! Toca rápido`);
    setGameZone(buzzerBox);
  }
});

socket.on('round:result', ({ correct, team, item }) => {
  clearInterval(answerTimer);
  document.getElementById('host-judge-controls').classList.add('hidden');
  setBuzzerState(false, 'ESPERA...', 'Esperando que el anfitrión pase de ronda...');
  document.getElementById('locked-icon').textContent = correct ? '🎉' : '😢';
  document.getElementById('locked-msg').textContent = correct ? `¡Punto para ${team.name}!` : 'Nadie acertó';
  document.getElementById('locked-team-name').textContent = item.title;
  setGameZone(lockedBanner);
});

socket.on('game:podium', ({ ranking }) => {
  const pos = ranking.findIndex(t => t.id === myTeam?.id) + 1;
  document.getElementById('locked-icon').textContent = pos === 1 ? '🏆' : '🎊';
  document.getElementById('locked-msg').textContent = pos > 0 ? `Puesto #${pos}` : '¡Juego Terminado!';
  document.getElementById('locked-team-name').textContent = 'Mira el podio en la TV.';
  setGameZone(lockedBanner);
});