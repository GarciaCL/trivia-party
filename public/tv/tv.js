import { initSetupWizard } from './setup-wizard.js';

const socket = io();

const teamsList = document.getElementById('teams-list');
const buzzerBanner = document.getElementById('buzzer-banner');
const alertTeamName = document.getElementById('alert-team-name');
const alertSubtitle = document.getElementById('alert-subtitle');
const welcomeLobby = document.getElementById('welcome-lobby');
const musicVisualizer = document.getElementById('music-visualizer');
const mediaStatusText = document.getElementById('media-status-text');
const btnNextRound = document.getElementById('btn-next-round');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const hostControls = document.getElementById('host-controls');
const podiumScreen = document.getElementById('podium-screen');
const podiumContainer = document.getElementById('podium-container');

let player = null, currentItem = null, gameStarted = false, currentMode = 'auto', selectedCat = 'all', allTeams = [];

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtube-player', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 1, controls: 0, disablekb: 1 }
  });
};

// Iniciar el asistente de 3 pasos en el lobby
initSetupWizard({
  onReadyToStart: ({ mode, category }) => {
    currentMode = mode;
    selectedCat = category;
    btnToggleMode.textContent = mode === 'host' ? 'MODO: PRESENTADOR [M]' : 'MODO: AUTO [M]';
    socket.emit('host:toggle_mode', { mode: currentMode });

    gameStarted = true;
    welcomeLobby.classList.add('hidden');
    podiumScreen?.classList.add('hidden');
    player?.unMute?.();
    socket.emit('host:next_round', { category: selectedCat });
  }
});

function toggleMode() {
  currentMode = currentMode === 'auto' ? 'host' : 'auto';
  btnToggleMode.textContent = currentMode === 'host' ? 'MODO: PRESENTADOR [M]' : 'MODO: AUTO [M]';
  socket.emit('host:toggle_mode', { mode: currentMode });
}
btnToggleMode.addEventListener('click', toggleMode);

const judge = (action, bonus = 0) => {
  socket.emit('host:judge', { action, bonus });
  hostControls.classList.add('hidden');
};
document.getElementById('btn-judge-correct')?.addEventListener('click', () => judge('correct'));
document.getElementById('btn-judge-wrong')?.addEventListener('click', () => judge('wrong'));
document.getElementById('btn-judge-bonus')?.addEventListener('click', () => judge('correct', 5));
btnNextRound.addEventListener('click', () => {
  if (gameStarted) socket.emit('host:next_round', { category: selectedCat });
});

function showPodium(winnerName = null) {
  if (!podiumScreen) return;
  player?.pauseVideo?.();
  podiumScreen.classList.remove('hidden');
  const titleEl = document.getElementById('podium-title');
  if (titleEl) titleEl.textContent = winnerName ? `👑 ¡${winnerName.toUpperCase()} LLEGÓ A 100 PTS! 👑` : '👑 ¡GRAN FINAL! 👑';
  const sorted = [...allTeams].sort((a, b) => b.score - a.score).slice(0, 3);
  const colors = ['#ffd700', '#c0c0c0', '#cd7f32'], heights = ['220px', '170px', '130px'];
  podiumContainer.innerHTML = sorted.map((t, i) => `
    <div style="flex:1; max-width:180px; height:${heights[i]}; background:${colors[i]}; color:#0d0221; border-radius:12px 12px 0 0; display:flex; flex-direction:column; justify-content:center; align-items:center; font-weight:800;">
      <span style="font-size:1.8rem;">#${i + 1}</span><span>${t.name}</span><span>${t.score} pts</span>
    </div>`).join('');
  if (window.confetti) window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
}
document.getElementById('btn-finish-game')?.addEventListener('click', () => showPodium());
document.getElementById('btn-restart-game')?.addEventListener('click', () => {
  podiumScreen.classList.add('hidden');
  socket.emit('host:next_round', { category: selectedCat });
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameStarted) {
    e.preventDefault();
    socket.emit('host:next_round', { category: selectedCat });
  } else if (e.key === 'm' || e.key === 'M') toggleMode();
  else if (e.key === 'f' || e.key === 'F') showPodium();
  else if (!hostControls.classList.contains('hidden')) {
    if (e.key === '1') judge('correct');
    else if (e.key === '2') judge('wrong');
    else if (e.key === '3') judge('correct', 5);
  }
});

socket.on('round:new', ({ item }) => {
  if (!gameStarted) return;
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
});

socket.on('buzzer:locked', ({ teamName }) => {
  player?.pauseVideo?.();
  alertTeamName.textContent = teamName;
  buzzerBanner.classList.remove('hidden');
  alertSubtitle.textContent = currentMode === 'host'
    ? '🎤 Responde oralmente: [1] Correcto | [2] Fallo | [3] Bonus'
    : 'Respondiendo en su celular (5s)...';
  if (currentMode === 'host') hostControls.classList.remove('hidden');
});

socket.on('round:success', ({ team, chorusSec }) => {
  alertSubtitle.textContent = `¡CORRECTO! +10 pts para ${team.name} 🎉`;
  hostControls.classList.add('hidden');
  setTimeout(() => {
    buzzerBanner.classList.add('hidden');
    if (currentItem?.type === 'music') mediaStatusText.textContent = `¡FESTEJO! 🎶 ${currentItem.title}`;
    player?.seekTo?.(chorusSec, true); player?.playVideo?.();
  }, 1200);
});

socket.on('round:fail', ({ team }) => {
  alertSubtitle.textContent = `¡FALLÓ! -10 pts para ${team.name} ❌ ¡ROBO DISPONIBLE!`;
  hostControls.classList.add('hidden');
  setTimeout(() => { buzzerBanner.classList.add('hidden'); player?.playVideo?.(); }, 1200);
});

socket.on('teams:updated', (teams) => {
  allTeams = teams;
  const counterEl = document.getElementById('lobby-teams-counter');
  if (counterEl) counterEl.textContent = `Equipos listos: ${teams.length}`;
  teamsList.innerHTML = teams.length === 0 ? '<li class="empty-notice">Esperando equipos...</li>' : '';
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  sorted.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'team-item';
    li.innerHTML = `<span>#${i + 1} ${t.name}</span><span class="score">${t.score} pts</span>`;
    teamsList.appendChild(li);
  });
  const winner = sorted.find(t => t.score >= 100);
  if (winner && podiumScreen?.classList.contains('hidden') && gameStarted) showPodium(winner.name);
});