const socket = io();

const adminLogin = document.getElementById('admin-login');
const adminDashboard = document.getElementById('admin-dashboard');
const formLogin = document.getElementById('form-login');
const inputPassword = document.getElementById('input-password');

const formItem = document.getElementById('form-item');
const itemsList = document.getElementById('items-list');

// 1. Verificación de Contraseña de Administrador
formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = inputPassword.value.trim();
  // Clave de acceso predeterminada
  if (password === 'admin123') {
    adminLogin.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    socket.emit('admin:get_items');
  } else {
    alert('Contraseña incorrecta. Intenta nuevamente.');
    inputPassword.value = '';
  }
});

// 2. Renderizado de la lista de canciones y clips
socket.on('admin:items_list', (items) => {
  itemsList.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'content-item';
    li.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.title}</span>
        <span class="item-meta">
          [${item.type.toUpperCase()}] • YouTube: ${item.youtubeId} • Inicio: ${item.startSec}s • Coro: ${item.chorusSec}s
        </span>
      </div>
      <button class="btn-delete" data-id="${item.id}">Eliminar</button>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm(`¿Eliminar "${item.title}"?`)) {
        socket.emit('admin:delete_item', { id: item.id });
      }
    });

    itemsList.appendChild(li);
  });
});

// 3. Envío de nueva canción o clip al servidor
formItem.addEventListener('submit', (e) => {
  e.preventDefault();

  const newItem = {
    id: `custom-${Date.now()}`,
    type: document.getElementById('item-type').value,
    title: document.getElementById('item-title').value.trim(),
    youtubeId: document.getElementById('item-ytid').value.trim(),
    startSec: parseInt(document.getElementById('item-start').value, 10),
    chorusSec: parseInt(document.getElementById('item-chorus').value, 10),
    correctAnswer: document.getElementById('item-correct').value.trim(),
    trapAnswer: document.getElementById('item-trap').value.trim(),
    distractors: [
      document.getElementById('item-d1').value.trim(),
      document.getElementById('item-d2').value.trim()
    ]
  };

  socket.emit('admin:add_item', newItem);
  formItem.reset();
});