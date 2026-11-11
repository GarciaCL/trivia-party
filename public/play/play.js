const socket = io();

// Referencias a vistas del DOM
const viewJoin = document.getElementById('view-join');
const viewBuzzer = document.getElementById('view-buzzer');
const viewOptions = document.getElementById('view-options');

// Elementos de interfaz
const formJoin = document.getElementById('form-join');
const inputName = document.getElementById('input-team-name');
const labelName = document.getElementById('label-team-name');
const labelScore = document.getElementById('label-team-score');
const btnBuzzer = document.getElementById('btn-buzzer');
const buzzerStatus = document.getElementById('buzzer-status');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const optButtons = document.querySelectorAll('.opt-btn');

let currentTeam = null;
let timerInterval = null;

// 1. Envío de formulario para unirse a la sala
formJoin.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  if (!name) return;
  socket.emit('team:join', { name });
});

socket.on('team:joined', ({ team }) => {
  currentTeam = team;
  labelName.textContent = team.name;
  labelScore.textContent = `${team.score} pts`;
  viewJoin.classList.add('hidden');
  viewBuzzer.classList.remove('hidden');
});

// 2. Pulsar el Buzzer ("¡ME LA SÉ!")
btnBuzzer.addEventListener('click', () => {
  btnBuzzer.disabled = true;
  buzzerStatus.textContent = '¡Verificando turno...!';
  socket.emit('buzzer:press');
});

// 3. Recepción de las 4 opciones con temporizador (Modo Automático)
socket.on('round:options', ({ options, timeLimit }) => {
  viewBuzzer.classList.add('hidden');
  viewOptions.classList.remove('hidden');

  options.forEach((optText, index) => {
    if (optButtons[index]) {
      optButtons[index].textContent = optText;
      optButtons[index].onclick = () => sendAnswer(optText);
    }
  });

  startTimer(timeLimit);
});

function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  timerBar.style.width = '100%';
  timerText.textContent = `${remaining}s`;

  timerInterval = setInterval(() => {
    remaining -= 1;
    timerText.textContent = `${remaining}s`;
    timerBar.style.width = `${(remaining / seconds) * 100}%`;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      sendAnswer(''); // Tiempo agotado: cuenta como fallo automático
    }
  }, 1000);
}

function sendAnswer(answer) {
  clearInterval(timerInterval);
  socket.emit('round:answer', { answer });
  viewOptions.classList.add('hidden');
  viewBuzzer.classList.remove('hidden');
  buzzerStatus.textContent = 'Respuesta enviada. Esperando resultado...';
}

// 4. Actualización de puntajes y reset de ronda
socket.on('teams:updated', (teams) => {
  if (!currentTeam) return;
  const me = teams.find((t) => t.id === currentTeam.id);
  if (me) {
    currentTeam.score = me.score;
    labelScore.textContent = `${me.score} pts`;
  }
});

socket.on('round:new', () => {
  btnBuzzer.disabled = false;
  buzzerStatus.textContent = '¡Nueva ronda! Pulsa cuando lo sepas';
  viewOptions.classList.add('hidden');
  viewBuzzer.classList.remove('hidden');
});