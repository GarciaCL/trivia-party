const socket = io();

let ytPlayer = null;
let playerReady = false;
let pendingItem = null;
let gameStarted = false;
let currentItemType = 'music';

const tvLobby = document.getElementById('tv-lobby');
const tvStage = document.getElementById('tv-stage');
const tvPodium = document.getElementById('tv-podium');

const MODE_LABELS = { auto: '🤖 Todos Juegan', host: '🎤 Con Presentador' };
const CAT_LABELS = { all: '🎲 Mixto', music: '🎵 Música', movie: '🎬 Cine y Series' };

function createYTPlayer() {
  if (ytPlayer || !window.YT?.Player) return;
  ytPlayer = new window.YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        if (pendingItem) {
          playMediaItem(pendingItem);
          pendingItem = null;
        }
      },
      onError: () => {
        if (gameStarted) socket.emit('host:next_round', {});
      }
    }
  });
}

window.onYouTubeIframeAPIReady = createYTPlayer;
if (window.YT?.Player) createYTPlayer();

function playMediaItem(item) {
  currentItemType = item.type || 'music';
  if (!playerReady || !ytPlayer?.loadVideoById) {
    pendingItem = item;
    createYTPlayer();
    return;
  }
  const ytWrapper = document.getElementById('yt-wrapper');
  const visualizer = document.getElementById('audio-visualizer');
  const eqBars = document.getElementById('eq-bars');

  if (currentItemType === 'movie') {
    ytWrapper.classList.remove('audio-hidden');
    visualizer.classList.add('hidden');
  } else {
    // En canciones, el video permanece oculto toda la ronda
    ytWrapper.classList.add('audio-hidden');
    visualizer.classList.remove('hidden');
    eqBars?.classList.remove('eq-paused');
  }

  ytPlayer.unMute();
  ytPlayer.setVolume(100);
  ytPlayer.loadVideoById({ videoId: item.youtubeId, startSeconds: item.startSec || 0 });
  ytPlayer.playVideo();
}

function updateLobbyQR(pin) {
  const playUrl = `${window.location.origin}/play?pin=${pin}`;
  document.getElementById('tv-room-pin').textContent = pin;
  document.getElementById('tv-join-url').textContent = `${window.location.host}/play`;
  document.getElementById('tv-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(playUrl)}`;
}

socket.on('state:sync', (state) => {
  updateLobbyQR(state.roomPin);

  document.getElementById('tv-teams-count').textContent = `${state.teams.length} equipo(s)`;
  const lobbyList = document.getElementById('tv-lobby-teams');
  lobbyList.innerHTML = state.teams.length
    ? state.teams.map(t => {
        const isHost = t.id === state.hostTeamId;
        const votes = state.hostVotesTally?.[t.id] || 0;
        return `
          <div class="glass-card" style="padding:12px 18px; border:2px solid ${isHost ? '#ffd700' : 'rgba(255,255,255,0.15)'};">
            <strong style="font-size:1.1rem; color:${isHost ? '#ffd700' : '#fff'};">${isHost ? '👑 ' : ''}${t.name}</strong>
            <div style="font-size:0.78rem; color:#00f0ff; margin-top:2px;">Votos anfitrión: ${votes}</div>
          </div>
        `;
      }).join('')
    : '<p style="color:#9a8c98;">Esperando que los jugadores escaneen el código QR...</p>';

  const hostTeam = state.teams.find(t => t.id === state.hostTeamId);
  document.getElementById('tv-host-badge').textContent = hostTeam ? `👑 ${hostTeam.name}` : 'Por votar';
  document.getElementById('tv-mode-badge').textContent = MODE_LABELS[state.mode] || state.mode;
  document.getElementById('tv-cat-badge').textContent = CAT_LABELS[state.category] || state.category;

  // Renderizar barra lateral derecha de equipos y puntajes
  document.getElementById('tv-round-label').textContent = `RONDA ${state.roundCount}`;
  document.getElementById('tv-scoreboard').innerHTML = state.teams.map((t, idx) => {
    const isBuzzed = state.buzzedTeam?.id === t.id;
    return `
      <div class="sidebar-team-card ${isBuzzed ? 'active-buzz' : ''}">
        <span style="font-weight:800; color:#fff;">#${idx + 1} ${t.id === state.hostTeamId ? '👑 ' : ''}${t.name}</span>
        <strong style="color:#ffd700; font-size:1.25rem;">${t.score}</strong>
      </div>
    `;
  }).join('');
});

socket.on('round:new', ({ item }) => {
  gameStarted = true;
  tvLobby.classList.add('hidden');
  tvPodium.classList.add('hidden');
  tvStage.classList.remove('hidden');

  document.getElementById('buzzed-banner').classList.add('hidden');
  document.getElementById('reveal-card').classList.add('hidden');
  document.getElementById('tv-category-pill').textContent = item.type === 'movie' ? '🎬 MODO VIDEO' : '🎵 MODO AUDIO';
  document.getElementById('stage-prompt-text').textContent = item.type === 'movie'
    ? '🎬 ¡ADIVINA LA PELÍCULA O SERIE!'
    : '🎵 ¡ESCUCHA Y PRESIONA TU TIMBRE!';

  playMediaItem(item);
});

socket.on('round:buzzed', ({ team }) => {
  ytPlayer?.pauseVideo?.();
  document.getElementById('eq-bars')?.classList.add('eq-paused');
  document.getElementById('buzzed-team-name').textContent = team.name;
  document.getElementById('buzzed-banner').classList.remove('hidden');
});

socket.on('round:steal', () => {
  document.getElementById('buzzed-banner').classList.add('hidden');
  document.getElementById('eq-bars')?.classList.remove('eq-paused');
  ytPlayer?.playVideo?.();
});

socket.on('round:result', ({ correct, team, item }) => {
  document.getElementById('buzzed-banner').classList.add('hidden');

  // Solo mostrar el video si es Película/Serie; si es Canción, mantener video oculto y animar ecualizador
  if (currentItemType === 'movie') {
    document.getElementById('yt-wrapper').classList.remove('audio-hidden');
    document.getElementById('audio-visualizer').classList.add('hidden');
  } else {
    document.getElementById('yt-wrapper').classList.add('audio-hidden');
    document.getElementById('audio-visualizer').classList.remove('hidden');
    document.getElementById('eq-bars')?.classList.remove('eq-paused');
  }

  const revealCard = document.getElementById('reveal-card');
  const statusText = document.getElementById('reveal-status-text');
  statusText.style.color = correct ? '#00ff88' : '#ff4d6d';
  statusText.textContent = correct
    ? `🎉 ¡PUNTO PARA ${team.name.toUpperCase()}!`
    : '😢 ¡NADIE ACERTÓ!';
  document.getElementById('reveal-song-title').textContent = item.title;
  revealCard.style.borderColor = correct ? '#00ff88' : '#ff4d6d';
  revealCard.classList.remove('hidden');

  if (ytPlayer?.seekTo) {
    ytPlayer.seekTo(item.chorusSec || 30, true);
    ytPlayer.playVideo();
  }
});

socket.on('game:podium', ({ ranking }) => {
  ytPlayer?.stopVideo?.();
  tvLobby.classList.add('hidden');
  tvStage.classList.add('hidden');
  tvPodium.classList.remove('hidden');

  const medals = ['🥇', '🥈', '🥉'];
  document.getElementById('podium-places').innerHTML = ranking.slice(0, 3).map((t, i) => `
    <div class="glass-card podium-card place-${i + 1}">
      <div class="medal">${medals[i]}</div>
      <h2>${t.name}</h2>
      <p>${t.score} pts</p>
    </div>
  `).join('');

  window.confetti?.({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
});