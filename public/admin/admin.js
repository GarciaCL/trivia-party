let previewPlayer = null;
let playerReady = false;
let pendingVideo = null;
let isVideoValid = false;
let currentVideoId = '';
let currentCorrectIndex = 0;
let catalogItems = [];

const statusBox = document.getElementById('preview-status');
const btnSave = document.getElementById('btn-save-item');
const inputYoutube = document.getElementById('item-youtube');
const inputStart = document.getElementById('item-start');
const inputTitle = document.getElementById('item-title');
const editIdInput = document.getElementById('edit-item-id');

function extractYouTubeId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : (trimmed.length === 11 ? trimmed : null);
}

function setSaveEnabled(enabled, label) {
  isVideoValid = enabled;
  btnSave.disabled = !enabled;
  btnSave.style.opacity = enabled ? '1' : '0.45';
  btnSave.style.cursor = enabled ? 'pointer' : 'not-allowed';
  btnSave.textContent = label;
}

function initPreviewPlayer() {
  if (previewPlayer || !window.YT?.Player) return;
  previewPlayer = new window.YT.Player('admin-yt-player', {
    height: '100%',
    width: '100%',
    playerVars: { autoplay: 1, controls: 1, playsinline: 1, origin: window.location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        if (pendingVideo) {
          runVideoTest(pendingVideo.id, pendingVideo.startSec);
          pendingVideo = null;
        }
      },
      onStateChange: (e) => {
        if (e.data === window.YT.PlayerState.PLAYING || e.data === window.YT.PlayerState.BUFFERING) {
          // Extraer título desde YouTube automáticamente si el campo está vacío
          const ytTitle = previewPlayer?.getVideoData?.()?.title;
          if (ytTitle && !inputTitle.value.trim()) {
            inputTitle.value = ytTitle.replace(/\(Official.*?\)|\[Official.*?\]/gi, '').trim();
          }
          statusBox.style.background = 'rgba(0, 255, 136, 0.2)';
          statusBox.style.color = '#00ff88';
          statusBox.textContent = '✅ ¡Video apto! Se reproduce y tiene permisos válidos.';
          setSaveEnabled(true, editIdInput.value ? '💾 ACTUALIZAR TEMA' : '💾 GUARDAR EN EL CATÁLOGO');
        }
      },
      onError: (e) => {
        const reasons = {
          2: 'ID de video inválido.',
          100: 'Video eliminado o privado.',
          101: 'Bloqueado por copyright (no permite reproducción externa).',
          150: 'Bloqueado por reclamación de estudio/disquera.'
        };
        statusBox.style.background = 'rgba(255, 42, 95, 0.25)';
        statusBox.style.color = '#ff4d6d';
        statusBox.textContent = `❌ No utilizable: ${reasons[e.data] || 'Error de permisos en YouTube.'}`;
        setSaveEnabled(false, '⚠️ ELIGE OTRO VIDEO VÁLIDO');
      }
    }
  });
}

function runVideoTest(id, startSec) {
  if (!playerReady || !previewPlayer?.loadVideoById) {
    pendingVideo = { id, startSec };
    initPreviewPlayer();
    return;
  }
  previewPlayer.unMute?.();
  previewPlayer.loadVideoById({ videoId: id, startSeconds: startSec });
  previewPlayer.playVideo();
}

window.onYouTubeIframeAPIReady = initPreviewPlayer;
if (window.YT?.Player) initPreviewPlayer();

// Generar distractores con IA y ubicar la respuesta correcta en una posición aleatoria (0-3)
document.getElementById('btn-ai-options').addEventListener('click', async () => {
  const title = inputTitle.value.trim();
  if (!title) return alert('Escribe primero el título (o prueba el video de YouTube para traerlo solo).');
  const btnAi = document.getElementById('btn-ai-options');
  btnAi.disabled = true;
  btnAi.textContent = '⏳...';

  try {
    const res = await fetch('/api/generate-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type: document.getElementById('item-type').value })
    });
    const data = await res.json();
    if (res.ok && data.distractors?.length === 3) {
      const randomPos = Math.floor(Math.random() * 4);
      currentCorrectIndex = randomPos;
      const mixed = [...data.distractors];
      mixed.splice(randomPos, 0, title);
      mixed.forEach((opt, i) => {
        document.getElementById(`opt-${i}`).value = opt;
      });
    } else {
      alert(`Error IA: ${data.error || 'Respuesta inválida de Gemini.'}`);
    }
  } catch (err) {
    alert('Error de red al conectar con el servidor.');
  } finally {
    btnAi.disabled = false;
    btnAi.textContent = '✨ IA';
  }
});

document.getElementById('btn-test-yt').addEventListener('click', () => {
  const id = extractYouTubeId(inputYoutube.value);
  if (!id) {
    statusBox.style.color = '#ffd700';
    statusBox.textContent = '⚠️ Ingresa un enlace o ID válido (11 caracteres).';
    return;
  }
  currentVideoId = id;
  setSaveEnabled(false, '⏳ COMPROBANDO...');
  statusBox.style.background = 'rgba(0, 240, 255, 0.15)';
  statusBox.style.color = '#00f0ff';
  statusBox.textContent = '⏳ Probando reproducción con YouTube...';
  runVideoTest(id, parseInt(inputStart.value, 10) || 0);
});

async function loadCatalog() {
  const res = await fetch('/api/content');
  catalogItems = await res.json();
  document.getElementById('catalog-count').textContent = catalogItems.length;
  const list = document.getElementById('catalog-list');
  list.innerHTML = catalogItems.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.06); border-radius:10px; gap:12px;">
      <div>
        <strong>${item.type === 'movie' ? '🎬' : '🎵'} ${item.title}</strong>
        <div style="font-size:0.8rem; color:#e0d4fc;">ID: ${item.youtubeId} • Inicio: ${item.startSec}s • Coro: ${item.chorusSec}s</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button onclick="editItem('${item._id}')" class="btn" style="background:#00f0ff; color:#0d0221; padding:8px 12px; font-size:0.85rem;">✏️ Editar</button>
        <button onclick="deleteItem('${item._id}')" class="btn" style="background:#ff2a5f; color:#fff; padding:8px 12px; font-size:0.85rem;">🗑️</button>
      </div>
    </div>
  `).join('');
}

window.editItem = (id) => {
  const item = catalogItems.find(i => String(i._id) === id);
  if (!item) return;
  editIdInput.value = item._id;
  currentCorrectIndex = item.correctIndex ?? 0;
  document.getElementById('form-heading').textContent = '✏️ Editando Tema';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  document.getElementById('item-type').value = item.type;
  inputTitle.value = item.title;
  inputYoutube.value = item.youtubeId;
  currentVideoId = item.youtubeId;
  inputStart.value = item.startSec;
  document.getElementById('item-chorus').value = item.chorusSec;
  (item.options || []).forEach((opt, i) => {
    const el = document.getElementById(`opt-${i}`);
    if (el) el.value = opt;
  });
  setSaveEnabled(true, '💾 ACTUALIZAR TEMA');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
  editIdInput.value = '';
  currentCorrectIndex = 0;
  document.getElementById('form-heading').textContent = '➕ Nuevo Tema';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  document.getElementById('form-add-item').reset();
  setSaveEnabled(false, '⚠️ PRUEBA EL VIDEO PRIMERO');
});

window.deleteItem = async (id) => {
  if (!confirm('¿Eliminar este tema del catálogo?')) return;
  await fetch(`/api/content/${id}`, { method: 'DELETE' });
  loadCatalog();
};

document.getElementById('form-add-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isVideoValid || !currentVideoId) return;

  const opts = [0, 1, 2, 3].map(i => document.getElementById(`opt-${i}`).value.trim());
  const title = inputTitle.value.trim();
  // Si el usuario escribió las opciones manualmente sin usar IA, mezclar aleatoriamente
  const foundIdx = opts.findIndex(o => o.toLowerCase() === title.toLowerCase());
  let finalOptions = opts;
  let finalCorrectIndex = foundIdx !== -1 ? foundIdx : currentCorrectIndex;

  if (foundIdx === 0 && !editIdInput.value) {
    const randomPos = Math.floor(Math.random() * 4);
    const distractors = opts.slice(1);
    distractors.splice(randomPos, 0, opts[0]);
    finalOptions = distractors;
    finalCorrectIndex = randomPos;
  }

  const payload = {
    type: document.getElementById('item-type').value,
    title,
    youtubeId: currentVideoId,
    startSec: parseInt(inputStart.value, 10) || 0,
    chorusSec: parseInt(document.getElementById('item-chorus').value, 10) || 30,
    options: finalOptions,
    correctIndex: finalCorrectIndex
  };

  const editId = editIdInput.value;
  const url = editId ? `/api/content/${editId}` : '/api/content';
  const method = editId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    document.getElementById('btn-cancel-edit').click();
    loadCatalog();
  }
});

loadCatalog();