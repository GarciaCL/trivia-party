let previewPlayer = null;
let isVideoValid = false;
let currentVideoId = '';

const statusBox = document.getElementById('preview-status');
const btnSave = document.getElementById('btn-save-item');
const inputYoutube = document.getElementById('item-youtube');
const inputStart = document.getElementById('item-start');

// Extraer ID limpio ya sea de una URL completa o un ID directo
function extractYouTubeId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : (trimmed.length === 11 ? trimmed : null);
}

window.onYouTubeIframeAPIReady = () => {
  previewPlayer = new window.YT.Player('admin-yt-player', {
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 0, controls: 1, origin: window.location.origin },
    events: {
      onStateChange: (e) => {
        // Estado 1 = PLAYING (El video cargó y tiene permisos válidos)
        if (e.data === window.YT.PlayerState.PLAYING) {
          isVideoValid = true;
          statusBox.style.background = 'rgba(0, 255, 136, 0.2)';
          statusBox.style.color = '#00ff88';
          statusBox.textContent = '✅ ¡Video apto! Se reproduce y suena correctamente.';
          btnSave.disabled = false;
          btnSave.style.opacity = '1';
          btnSave.style.cursor = 'pointer';
          btnSave.textContent = '💾 GUARDAR EN EL CATÁLOGO';
        }
      },
      onError: (e) => {
        isVideoValid = false;
        const reasons = {
          2: 'ID de video inválido.',
          100: 'Video eliminado o marcado como privado.',
          101: 'Bloqueado por derechos de autor (no permite reproducción externa).',
          150: 'Bloqueado por derechos de autor (reclamación de estudio/disquera).'
        };
        statusBox.style.background = 'rgba(255, 42, 95, 0.25)';
        statusBox.style.color = '#ff4d6d';
        statusBox.textContent = `❌ No utilizable: ${reasons[e.data] || 'Error de permisos en YouTube.'}`;
        btnSave.disabled = true;
        btnSave.style.opacity = '0.45';
        btnSave.style.cursor = 'not-allowed';
        btnSave.textContent = '⚠️ ELIGE OTRO VIDEO VÁLIDO';
      }
    }
  });
};

document.getElementById('btn-test-yt').addEventListener('click', () => {
  const id = extractYouTubeId(inputYoutube.value);
  if (!id) {
    statusBox.style.color = '#ffd700';
    statusBox.textContent = '⚠️ Ingresa un enlace o ID de YouTube válido (11 caracteres).';
    return;
  }
  currentVideoId = id;
  isVideoValid = false;
  btnSave.disabled = true;
  btnSave.style.opacity = '0.45';
  statusBox.style.background = 'rgba(0, 240, 255, 0.15)';
  statusBox.style.color = '#00f0ff';
  statusBox.textContent = '⏳ Comprobando permisos de reproducción con YouTube...';

  const startSec = parseInt(inputStart.value, 10) || 0;
  previewPlayer?.loadVideoById({ videoId: id, startSeconds: startSec });
  previewPlayer?.playVideo();
});

document.getElementById('form-add-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isVideoValid || !currentVideoId) return;

  const payload = {
    type: document.getElementById('item-type').value,
    title: document.getElementById('item-title').value.trim(),
    youtubeId: currentVideoId,
    startSec: parseInt(inputStart.value, 10) || 0,
    chorusSec: parseInt(document.getElementById('item-chorus').value, 10) || 30,
    options: [
      document.getElementById('opt-0').value.trim(),
      document.getElementById('opt-1').value.trim(),
      document.getElementById('opt-2').value.trim(),
      document.getElementById('opt-3').value.trim()
    ],
    correctIndex: 0
  };

  const res = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    alert('🎉 ¡Tema guardado y listo para jugar!');
    e.target.reset();
    isVideoValid = false;
    btnSave.disabled = true;
    btnSave.style.opacity = '0.45';
    btnSave.textContent = '⚠️ PRUEBA EL VIDEO PRIMERO';
  }
});