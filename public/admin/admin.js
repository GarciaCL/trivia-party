let previewPlayer = null;
let isVideoValid = false;
let currentVideoId = '';
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

window.onYouTubeIframeAPIReady = () => {
  previewPlayer = new window.YT.Player('admin-yt-player', {
    height: '100%', width: '100%',
    playerVars: { autoplay: 0, controls: 1, origin: window.location.origin },
    events: {
      onStateChange: (e) => {
        if (e.data === window.YT.PlayerState.PLAYING) {
          statusBox.style.background = 'rgba(0, 255, 136, 0.2)';
          statusBox.style.color = '#00ff88';
          statusBox.textContent = '✅ ¡Video apto! Se reproduce y suena correctamente.';
          setSaveEnabled(true, editIdInput.value ? '💾 ACTUALIZAR TEMA' : '💾 GUARDAR EN EL CATÁLOGO');
        }
      },
      onError: (e) => {
        const reasons = { 2: 'ID inválido.', 100: 'Video eliminado o privado.', 101: 'Bloqueado por copyright.', 150: 'Bloqueado por reclamación de estudio.' };
        statusBox.style.background = 'rgba(255, 42, 95, 0.25)';
        statusBox.style.color = '#ff4d6d';
        statusBox.textContent = `❌ No utilizable: ${reasons[e.data] || 'Error de permisos.'}`;
        setSaveEnabled(false, '⚠️ ELIGE OTRO VIDEO VÁLIDO');
      }
    }
  });
};

// Autocompletar Opción 1 con el título y generar distractores con Gemini
inputTitle.addEventListener('blur', () => {
  if (!document.getElementById('opt-0').value && inputTitle.value.trim()) {
    document.getElementById('opt-0').value = inputTitle.value.trim();
  }
});

document.getElementById('btn-ai-options').addEventListener('click', async () => {
  const title = inputTitle.value.trim();
  if (!title) return alert('Escribe primero el título de la canción o película.');
  const btnAi = document.getElementById('btn-ai-options');
  btnAi.disabled = true;
  btnAi.textContent = '⏳...';

  document.getElementById('opt-0').value = title;
  const res = await fetch('/api/generate-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, type: document.getElementById('item-type').value })
  });
  const data = await res.json();
  if (data.distractors?.length === 3) {
    document.getElementById('opt-1').value = data.distractors[0];
    document.getElementById('opt-2').value = data.distractors[1];
    document.getElementById('opt-3').value = data.distractors[2];
  } else {
    alert(data.error || 'No se pudieron generar las opciones.');
  }
  btnAi.disabled = false;
  btnAi.textContent = '✨ IA';
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
  previewPlayer?.loadVideoById({ videoId: id, startSeconds: parseInt(inputStart.value, 10) || 0 });
  previewPlayer?.playVideo();
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

  const payload = {
    type: document.getElementById('item-type').value,
    title: inputTitle.value.trim(),
    youtubeId: currentVideoId,
    startSec: parseInt(inputStart.value, 10) || 0,
    chorusSec: parseInt(document.getElementById('item-chorus').value, 10) || 30,
    options: [0, 1, 2, 3].map(i => document.getElementById(`opt-${i}`).value.trim()),
    correctIndex: 0
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