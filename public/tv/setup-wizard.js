// Asistente paso a paso previo al inicio de la partida
export function initSetupWizard({ onReadyToStart }) {
    const lobby = document.getElementById('welcome-lobby');
    if (!lobby) return;
  
    let chosenMode = 'auto';
    let chosenCategory = 'all';
    let countdownDone = false;
  
    // Reemplazamos el contenido interno del lobby por el flujo de 3 pasos
    lobby.innerHTML = `
      <!-- PASO 1: MODALIDAD -->
      <div id="step-mode" style="display:flex; flex-direction:column; align-items:center; gap:18px; width:100%;">
        <h1 class="lobby-title">CONFIGURA LA PARTIDA</h1>
        <p class="lobby-sub">Paso 1 de 3: ¿Cómo quieren jugar hoy?</p>
        <div style="display:flex; gap:16px; flex-wrap:wrap; justify-content:center; width:90%;">
          <button id="wiz-mode-host" class="btn" style="flex:1; min-width:210px; padding:22px; font-size:1.1rem; background:#ff007f; color:#fff; border-radius:16px;">
            🎤 JUGAR CON PRESENTADOR<br><small style="font-weight:600; opacity:0.9;">Un animador califica las respuestas</small>
          </button>
          <button id="wiz-mode-auto" class="btn" style="flex:1; min-width:210px; padding:22px; font-size:1.1rem; background:#00f0ff; color:#0d0221; border-radius:16px;">
            🤖 TODOS JUEGAN<br><small style="font-weight:600; opacity:0.85;">4 opciones en cada celular (Automático)</small>
          </button>
        </div>
      </div>
  
      <!-- PASO 2: TIPO DE JUEGO -->
      <div id="step-category" class="hidden" style="display:flex; flex-direction:column; align-items:center; gap:18px; width:100%;">
        <h1 class="lobby-title">ELIGE LA TEMÁTICA</h1>
        <p class="lobby-sub">Paso 2 de 3: ¿Qué categorías entran en juego?</p>
        <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:center; width:90%;">
          <button data-cat="music" class="wiz-cat-btn btn" style="flex:1; min-width:160px; padding:20px; font-size:1.1rem; background:#ff007f; color:#fff; border-radius:14px;">🎵 SÓLO MÚSICA</button>
          <button data-cat="movie" class="wiz-cat-btn btn" style="flex:1; min-width:160px; padding:20px; font-size:1.1rem; background:#ffd700; color:#0d0221; border-radius:14px;">🎬 SÓLO CINE</button>
          <button data-cat="all" class="wiz-cat-btn btn" style="flex:1; min-width:160px; padding:20px; font-size:1.1rem; background:#00f0ff; color:#0d0221; border-radius:14px;">🔀 MIXTO</button>
        </div>
      </div>
  
      <!-- PASO 3: SALA QR + ESPERA DE 10 SEGUNDOS -->
      <div id="step-qr" class="hidden" style="display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;">
        <h1 class="lobby-title">¡ESCANEA PARA UNIRTE!</h1>
        <p id="wiz-summary" class="lobby-sub" style="color:#00f0ff;"></p>
        <div class="qr-giant-wrapper"><div id="qr-code"></div></div>
        <p id="lobby-teams-counter" class="lobby-counter">Equipos listos: 0</p>
        <button id="btn-start-party" class="btn btn-start-game" disabled style="opacity:0.5; cursor:not-allowed;">
          ⏳ ESPERANDO JUGADORES (10s)...
        </button>
      </div>
    `;
  
    const stepMode = document.getElementById('step-mode');
    const stepCategory = document.getElementById('step-category');
    const stepQr = document.getElementById('step-qr');
    const btnStart = document.getElementById('btn-start-party');
  
    // Ir al Paso 2
    const selectMode = (mode) => {
      chosenMode = mode;
      stepMode.classList.add('hidden');
      stepCategory.classList.remove('hidden');
    };
    document.getElementById('wiz-mode-host').addEventListener('click', () => selectMode('host'));
    document.getElementById('wiz-mode-auto').addEventListener('click', () => selectMode('auto'));
  
    // Ir al Paso 3 (Mostrar QR e iniciar cuenta regresiva de 10s)
    document.querySelectorAll('.wiz-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chosenCategory = btn.dataset.cat;
        stepCategory.classList.add('hidden');
        stepQr.classList.remove('hidden');
  
        const modeLabel = chosenMode === 'host' ? '🎤 Con Presentador' : '🤖 Todos Juegan';
        const catLabel = chosenCategory === 'music' ? '🎵 Música' : (chosenCategory === 'movie' ? '🎬 Cine' : '🔀 Mixto');
        document.getElementById('wiz-summary').textContent = `${modeLabel} • ${catLabel}`;
  
        // Generar el QR apuntando a /play
        const qrBox = document.getElementById('qr-code');
        if (qrBox && window.QRCode) {
          qrBox.innerHTML = '';
          new window.QRCode(qrBox, {
            text: `${window.location.origin}/play`,
            width: 175, height: 175, colorDark: '#0d0221', colorLight: '#ffffff'
          });
        }
  
        // Cuenta regresiva obligatoria de 10 segundos
        let secondsLeft = 10;
        const timer = setInterval(() => {
          secondsLeft--;
          if (secondsLeft > 0) {
            btnStart.textContent = `⏳ ESPERANDO JUGADORES (${secondsLeft}s)...`;
          } else {
            clearInterval(timer);
            countdownDone = true;
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnStart.style.cursor = 'pointer';
            btnStart.textContent = '🎉 ¡INICIAR JUEGO! 🎉';
          }
        }, 1000);
      });
    });
  
    // Verificación de jugadores antes de arrancar
    // Verificación de jugadores antes de arrancar con SweetAlert2
  btnStart.addEventListener('click', async () => {
    if (!countdownDone) return;
    const countText = document.getElementById('lobby-teams-counter')?.textContent || '0';
    const teamCount = parseInt(countText.replace(/\D/g, ''), 10) || 0;

    if (teamCount === 0) {
      window.Swal?.fire({
        icon: 'warning',
        title: '¡Faltan jugadores!',
        text: 'Pide a los participantes que escaneen el código QR con su celular antes de comenzar.',
        background: '#140533',
        color: '#fff',
        confirmButtonColor: '#00f0ff'
      });
      return;
    }

    if (teamCount === 1) {
      const res = await window.Swal?.fire({
        icon: 'question',
        title: 'Solo hay 1 equipo conectado',
        text: '¿Deseas iniciar la partida ahora o esperar a que se unan más jugadores?',
        showCancelButton: true,
        confirmButtonText: '🎉 ¡Iniciar ahora!',
        cancelButtonText: 'Esperar más jugadores',
        confirmButtonColor: '#ff007f',
        cancelButtonColor: '#3a2d5c',
        background: '#140533',
        color: '#fff'
      });
      if (!res?.isConfirmed) return;
    }

    onReadyToStart({ mode: chosenMode, category: chosenCategory });
  });
  }