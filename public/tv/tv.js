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

let player = null;
let currentItem = null;
let gameStarted = false;

// Generar QR Gigante en el Lobby
function initLobbyQR() {
  const qrContainer = document.getElementById('qr-code');
  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: `${window.location.origin}/play`,
      width: 180,
      height: 180,
      colorDark: '#0d0221',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}
initLobbyQR();

// Inicializar YouTube IFrame API
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0 }
  });
};

// Botón de Inicio: Oculta el lobby, activa sonido y lanza la primera canción
btnStartParty.addEventListener('click', () => {
  gameStarted = true;
  welcomeLobby.classList.add('hidden');
  if (player && player.unMute) player.unMute();
  socket.emit('host:next_round');
});

function loadMedia(item) {
  currentItem = item;
  buzzerBanner.classList.add('hidden');

  if (item.type === 'music') {
    musicVisualizer.classList.remove('hidden');
    mediaStatusText.textContent = '¡ESCUCHA CON ATENCIÓN!';
  } else {
    musicVisualizer.classList.add('hidden');
  }

  if (player && player.loadVideoById) {
    player.unMute();
    player.setVolume(100);
    player.loadVideoById({ videoId: item.youtubeId, startSeconds: item.startSec });
    player.playVideo();
  }
}

btnNextRound.addEventListener('click', () => socket.emit('host:next_round'));
socket.on('round:new', ({ item }) => {
  if (gameStarted) loadMedia(item);
});

socket.on('buzzer:locked', ({ teamName }) => {
  if (player && player.pauseVideo) player.pauseVideo();
  alertTeamName.textContent = teamName;
  alertSubtitle.textContent = 'Respondiendo en su celular (5s)...';
  buzzerBanner.classList.remove('hidden');
});

socket.on('round:success', ({ team, chorusSec }) => {
  alertSubtitle.textContent = `¡CORRECTO! +10 pts para ${team.name} 🎉`;
  setTimeout(() => {
    buzzerBanner.classList.add('hidden');
    if (currentItem.type === 'music') {
      mediaStatusText.textContent = `¡FESTEJO! 🎶 ${currentItem.title}`;
    }
    if (player && player.seekTo) {
      player.seekTo(chorusSec, true);
      player.playVideo();
    }
  }, 1200);
});

socket.on('round:fail', ({ team }) => {
  alertSubtitle.textContent = `¡FALLÓ! -10 pts para ${team.name} ❌`;
  setTimeout(() => {
    buzzerBanner.classList.add('hidden');
    if (player && player.playVideo) player.playVideo();
  }, 1500);
});

socket.on('teams:updated', (teams) => {
  lobbyCounter.textContent = `Equipos listos: ${teams.length}`;
  teamsList.innerHTML = '';
  if (teams.length === 0) {
    teamsList.innerHTML = '<li class="empty-notice">Esperando equipos...</li>';
    return;
  }
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  sorted.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'team-item';
    li.innerHTML = `<span>#${i + 1} ${t.name}</span><span class="score">${t.score} pts</span>`;
    teamsList.appendChild(li);
  });
});