import { initSetupWizard } from './setup-wizard.js';

const socket = io();

let ytPlayer = null;
let playerReady = false;
let pendingItem = null;
let lastGeneratedPin = null;

const MODE_LABELS = { auto: 'MODO: AUTO [M]', host: 'MODO: PRESENTADOR [M]' };
const CAT_LABELS = { all: 'MIXTO', music: 'SÓLO MÚSICA', movie: 'SÓLO CINE' };

function initYT() {
  if (ytPlayer || !window.YT?.Player) return;
  ytPlayer = new window.YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        if (pendingItem) {
          loadStageMedia(pendingItem);
          pendingItem = null;
        }
      },
      onError: () => socket.emit('host:next_round', {})
    }
  });
}

window.onYouTubeIframeAPIReady = initYT;
if (window.YT?.Player) initYT();

function loadStageMedia(item) {
  if (!playerReady || !ytPlayer?.loadVideoById) {
    pendingItem = item;
    initYT();
    return;
  }
  const mask = document.getElementById('player-mask');
  const visualizer = document.getElementById('music-visualizer');

  if (item.type === 'movie') {
    mask.classList.remove('hidden');
    visualizer.classList.add('hidden');
  } else {
    mask.classList.add('hidden');
    visualizer.classList.remove('hidden');
  }

  ytPlayer.unMute();
  ytPlayer.setVolume(100);
  ytPlayer.loadVideoById({ videoId: item.youtubeId, startSeconds: item.startSec || 0 });
  ytPlayer.playVideo();
}

function renderQRCode(pin) {
  if (!pin || pin === lastGeneratedPin) return;
  lastGeneratedPin = pin;
  document.getElementById('pin-display').textContent = pin;
  const qrContainer = document.getElementById('qr-code');
  qrContainer.innerHTML = '';
  const joinUrl = `${window.location.origin}/play?pin=${pin}`;
  if (window.QRCode) {
    new window.QRCode(qrContainer, {
      text: joinUrl,
      width: 200,
      height: 200,
      colorDark: '#0d0221',
      colorLight: '#ffffff'
    });
  }
}

socket.on('state:sync', (state) => {
  renderQRCode(state.roomPin);

  document.getElementById('btn-toggle-mode').textContent = MODE_LABELS[state.mode] || 'MODO: AUTO [M]';
  document.getElementById('badge-type').textContent = CAT_LABELS[state.category] || 'MIXTO';

  const hostTeam = state.teams.find(t => t.id === state.hostTeamId);
  const hostLabel = hostTeam ? ` • 👑 Anfitrión: ${hostTeam.name}` : '';
  document.getElementById('lobby-teams-counter').textContent = `Equipos listos: ${state.teams.length}${hostLabel}`;

  const hostStatusEl = document.getElementById('lobby-host-status');
  if (hostStatusEl) {
    hostStatusEl.textContent = hostTeam
      ? `👑 Anfitrión: ${hostTeam.name} (configurando en su celular...)`
      : 'Voten al anfitrión en su celular para configurar e iniciar';
  }

  const teamsList = document.getElementById('teams-list');
  teamsList.innerHTML = state.teams.length
    ? state.teams.map((t, idx) => {
        const isHost = t.id === state.hostTeamId;
        const votes = state.hostVotesTally?.[t.id] || 0;
        const voteTag = state.phase === 'lobby' ? ` <small style="color:#00f0ff;">(${votes}v)</small>` : '';
        return `
          <li>
            <span>#${idx + 1} ${isHost ? '👑 ' : ''}${t.name}${voteTag}</span>
            <strong style="color:var(--neon-yellow);">${t.score} pts</strong>
          </li>
        `;
      }).join('')
    : '<li class="empty-notice">Esperando equipos...</li>';
});

document.getElementById('btn-next-round')?.addEventListener('click', () => {
  socket.emit('host:next_round', {});
});
document.getElementById('btn-judge-correct')?.addEventListener('click', () => {
  socket.emit('host:judge', { isCorrect: true });
});
document.getElementById('btn-judge-wrong')?.addEventListener('click', () => {
  socket.emit('host:judge', { isCorrect: false });
});
document.getElementById('btn-judge-bonus')?.addEventListener('click', () => {
  socket.emit('host:judge', { isCorrect: true, bonus: true });
});

socket.on('round:new', ({ item }) => {
  document.getElementById('welcome-lobby').classList.add('hidden');
  document.getElementById('buzzer-banner').classList.add('hidden');
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('media-status-text').textContent = '¡ESCUCHA CON ATENCIÓN!';
  loadStageMedia(item);
});

socket.on('round:buzzed', ({ team, mode }) => {
  ytPlayer?.pauseVideo?.();
  document.getElementById('alert-team-name').textContent = team.name;
  document.getElementById('alert-subtitle').textContent = mode === 'host'
    ? 'Respondiendo en voz alta...'
    : 'Respondiendo en su celular (5s)...';
  document.getElementById('buzzer-banner').classList.remove('hidden');
  if (mode === 'host') {
    document.getElementById('host-controls').classList.remove('hidden');
  }
});

socket.on('round:steal', () => {
  document.getElementById('buzzer-banner').classList.add('hidden');
  document.getElementById('host-controls').classList.add('hidden');
  ytPlayer?.playVideo?.();
});

socket.on('round:result', ({ correct, team, item }) => {
  document.getElementById('buzzer-banner').classList.add('hidden');
  document.getElementById('host-controls').classList.add('hidden');

  const statusEl = document.getElementById('media-status-text');
  if (item.type === 'movie') {
    document.getElementById('player-mask').classList.remove('hidden');
    document.getElementById('music-visualizer').classList.add('hidden');
  } else {
    document.getElementById('player-mask').classList.add('hidden');
    document.getElementById('music-visualizer').classList.remove('hidden');
    statusEl.innerHTML = correct
      ? `¡FESTEJO! 🎶 ${item.title}`
      : `😢 Era: 🎶 ${item.title}`;
  }

  if (ytPlayer?.seekTo) {
    ytPlayer.seekTo(item.chorusSec || 30, true);
    ytPlayer.playVideo();
  }
});

socket.on('game:podium', ({ ranking }) => {
  ytPlayer?.stopVideo?.();
  const top = ranking.slice(0, 3).map((t, i) => `#${i + 1} ${t.name} (${t.score} pts)`).join('<br>');
  window.Swal?.fire({
    title: '🏆 ¡PODIO FINAL! 🏆',
    html: top || 'Sin equipos',
    background: '#140533',
    color: '#fff',
    confirmButtonText: '🔄 Nueva Partida (Misma Sala)',
    confirmButtonColor: '#ff007f'
  }).then(() => {
    socket.emit('host:reset_lobby');
  });
});

socket.on('game:back_to_lobby', () => {
  ytPlayer?.stopVideo?.();
  document.getElementById('buzzer-banner').classList.add('hidden');
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('welcome-lobby').classList.remove('hidden');
});