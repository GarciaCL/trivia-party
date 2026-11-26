const socket = io();

const loginView = document.getElementById('login-view');
const gameView = document.getElementById('game-view');
const formJoin = document.getElementById('form-join');
const inputTeamName = document.getElementById('input-team-name');
const playerTeamDisplay = document.getElementById('player-team-display');
const playerScoreDisplay = document.getElementById('player-score-display');
const buzzerBox = document.getElementById('buzzer-box');
const btnBuzzer = document.getElementById('btn-buzzer');
const buzzerHint = document.getElementById('buzzer-hint');
const optionsPanel = document.getElementById('options-panel');
const optionsGrid = document.getElementById('options-grid');
const lockedBanner = document.getElementById('locked-banner');
const lockedMsg = document.getElementById('locked-msg');
const lockedTeamName = document.getElementById('locked-team-name');
const hostModeBanner = document.getElementById('host-mode-banner');

let myTeam = null, currentOptions = [];
const colorClasses = ['opt-orange', 'opt-cyan', 'opt-yellow', 'opt-pink'];

formJoin.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputTeamName.value.trim();
  if (name) socket.emit('team:join', { teamName: name });
});

socket.on('team:joined', (team) => {
  myTeam = team;
  playerTeamDisplay.textContent = team.name;
  loginView.classList.add('hidden');
  gameView.classList.remove('hidden');
});

socket.on('round:options', ({ options }) => { currentOptions = options || []; });

function resetBuzzerView() {
  buzzerBox.classList.remove('hidden');
  btnBuzzer.disabled = false;
  btnBuzzer.querySelector('.buzzer-text').textContent = '¡ME LA SÉ!';
  buzzerHint.textContent = '¡Pulsa rápido cuando reconozcas el tema!';
  optionsPanel.classList.add('hidden');
  lockedBanner.classList.add('hidden');
  hostModeBanner.classList.add('hidden');
}

socket.on('round:new', resetBuzzerView);

btnBuzzer.addEventListener('click', () => {
  btnBuzzer.disabled = true;
  if (navigator.vibrate) navigator.vibrate(200);
  socket.emit('buzzer:press');
});

socket.on('buzzer:locked', ({ teamId, teamName, mode }) => {
  buzzerBox.classList.add('hidden');
  if (myTeam && teamId === myTeam.id) {
    if (mode === 'host') {
      hostModeBanner.classList.remove('hidden');
    } else {
      optionsPanel.classList.remove('hidden');
      renderOptions();
    }
  } else {
    lockedMsg.textContent = '¡Turno Bloqueado!';
    lockedTeamName.textContent = `${teamName} está respondiendo...`;
    lockedBanner.classList.remove('hidden');
  }
});

function renderOptions() {
  optionsGrid.innerHTML = '';
  currentOptions.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = `opt-btn ${colorClasses[idx % 4]}`;
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      socket.emit('player:answer', { answerIndex: idx });
      optionsPanel.classList.add('hidden');
      buzzerBox.classList.remove('hidden');
      btnBuzzer.disabled = true;
    });
    optionsGrid.appendChild(btn);
  });
}

socket.on('round:success', ({ team }) => {
  if (myTeam && team.id === myTeam.id) myTeam.score = team.score;
  setTimeout(resetBuzzerView, 1200);
});

socket.on('round:fail', ({ team, attemptedTeams = [] }) => {
  if (myTeam && team.id === myTeam.id) myTeam.score = team.score;
  setTimeout(() => {
    optionsPanel.classList.add('hidden');
    hostModeBanner.classList.add('hidden');
    if (myTeam && attemptedTeams.includes(myTeam.id)) {
      buzzerBox.classList.add('hidden');
      lockedMsg.textContent = '¡Fallaste en esta ronda!';
      lockedTeamName.textContent = 'Espera la siguiente canción... ❌';
      lockedBanner.classList.remove('hidden');
    } else {
      lockedBanner.classList.add('hidden');
      buzzerBox.classList.remove('hidden');
      btnBuzzer.disabled = false;
      btnBuzzer.querySelector('.buzzer-text').textContent = '¡ROBAR! ⚡';
    }
  }, 1200);
});

socket.on('teams:updated', (teams) => {
  if (!myTeam) return;
  const updated = teams.find(t => t.id === myTeam.id);
  if (updated) {
    myTeam.score = updated.score;
    playerScoreDisplay.textContent = `${updated.score} pts`;
  }
});