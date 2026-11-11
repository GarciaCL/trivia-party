const socket = io();

const teamsList = document.getElementById('teams-list');
const buzzerBanner = document.getElementById('buzzer-banner');
const alertTeamName = document.getElementById('alert-team-name');
const alertSubtitle = document.getElementById('alert-subtitle');
const welcomeLobby = document.getElementById('welcome-lobby');
const lobbyCounter = document.getElementById('lobby-teams-counter');
const btnStartParty = document.getElementById('btn-start-party');
const musicVisualizer = document.getElementById('music-visualizer');
const mediaStatusText = document.getElementById('media-status-text');
const btnNextRound = document.getElementById('btn-next-round');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const hostControls = document.getElementById('host-controls');
const btnCorrect = document.getElementById('btn-judge-correct');
const btnWrong = document.getElementById('btn-judge-wrong');
const btnBonus = document.getElementById('btn-judge-bonus');

let player = null, currentItem = null, gameStarted = false, currentMode = 'auto';

function initLobbyQR() {
  const qrContainer = document.getElementById('qr-code');
  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: `${window.location.origin}/play`, width: 180, height: 180,
      colorDark: '#0d0221', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H
    });
  }
}
initLobbyQR();

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtube-player', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0 }
  });
};

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  welcomeLobby.classList.add('hidden');
  if (player?.unMute) player.unMute();
  socket.emit('host:next_round');
}
btnStartParty.addEventListener('click', startGame);

function toggleMode() {
  currentMode = currentMode === 'auto' ? 'host' : 'auto';
  btnToggleMode.textContent = `MODO: ${currentMode.toUpperCase()} [M]`;
  socket.emit('host:toggle_mode', { mode: currentMode });
}
btnToggleMode.addEventListener('click', toggleMode);

const judge = (action, bonus = 0) => {
  socket.emit('host:judge', { action, bonus });
  hostControls.classList.add('hidden');
};
btnCorrect.addEventListener('click', () => judge('correct'));
btnWrong.addEventListener('click', () => judge('wrong'));
btnBonus.addEventListener('click', () => judge('correct', 5));
btnNextRound.addEventListener('click', () => socket.emit('host:next_round'));

// Atajos de teclado para el presentador
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!gameStarted) startGame(); else socket.emit('host:next_round');
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMode();
  } else if (!hostControls.classList.contains('hidden')) {
    if (e.key === '1') judge('correct');
    else if (e.key === '2') judge('wrong');
    else if (e.key === '3') judge('correct', 5);
  }
});

function loadMedia(item) {
  currentItem = item;
  buzzerBanner.classList.add('hidden');
  hostControls.classList.add('hidden');
  musicVisualizer.classList.toggle('hidden', item.type !== 'music');
  if (item.type === 'music') mediaStatusText.textContent = '¡ESCUCHA CON ATENCIÓN!';
  if (player?.loadVideoById) {
    player.unMute(); player.setVolume(100);
    player.loadVideoById({ videoId: item.youtubeId, startSeconds: item.startSec });
    player.playVideo();
  }
}

socket.on('round:new', ({ item }) => { if (gameStarted) loadMedia(item); });
socket.on('buzzer:locked', ({ teamName }) => {
  if (player?.pauseVideo) player.pauseVideo();
  alertTeamName.textContent = teamName;
  buzzerBanner.classList.remove('hidden');
  if (currentMode === 'host') {
    alertSubtitle.textContent = '🎤 Responde oralmente: [1] Correcto | [2] Fallo | [3] Bonus';
    hostControls.classList.remove('hidden');
  } else {
    alertSubtitle.textContent = 'Respondiendo en su celular (5s)...';
  }
});

socket.on('round:success', ({ team, chorusSec }) => {
  alertSubtitle.textContent = `¡CORRECTO! +10 pts para ${team.name} 🎉`;
  hostControls.classList.add('hidden');
  setTimeout(() => {
    buzzerBanner.classList.add('hidden');
    if (currentItem?.type === 'music') mediaStatusText.textContent = `¡FESTEJO! 🎶 ${currentItem.title}`;
    if (player?.seekTo) { player.seekTo(chorusSec, true); player.playVideo(); }
  }, 1200);
});

socket.on('round:fail', ({ team }) => {
  alertSubtitle.textContent = `¡FALLÓ! -10 pts para ${team.name} ❌`;
  hostControls.classList.add('hidden');
  setTimeout(() => { buzzerBanner.classList.add('hidden'); player?.playVideo?.(); }, 1500);
});

socket.on('teams:updated', (teams) => {
  lobbyCounter.textContent = `Equipos listos: ${teams.length}`;
  teamsList.innerHTML = teams.length === 0 ? '<li class="empty-notice">Esperando equipos...</li>' : '';
  [...teams].sort((a, b) => b.score - a.score).forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'team-item';
    li.innerHTML = `<span>#${i + 1} ${t.name}</span><span class="score">${t.score} pts</span>`;
    teamsList.appendChild(li);
  });
});