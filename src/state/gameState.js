import { initialItems } from './contentData.js';

// Estado global de la sala en memoria
export const state = {
  roomPin: '1234',
  gameMode: 'auto', // 'auto' (4 opciones) o 'host' (con presentador)
  contentType: 'music', // 'music' o 'movie'
  items: [...initialItems],
  currentIndex: 0,
  buzzerLockedBy: null, // ID del equipo que ganó el turno del buzzer
  buzzedTeamsInRound: new Set(), // Equipos que ya fallaron en esta ronda
  teams: new Map() // socketId -> { id, name, score }
};

// Registro y gestión de equipos
export function registerTeam(socketId, name) {
  const team = {
    id: socketId,
    name: name.trim() || `Equipo-${socketId.slice(0, 4)}`,
    score: 0
  };
  state.teams.set(socketId, team);
  return team;
}

export function removeTeam(socketId) {
  state.teams.delete(socketId);
  if (state.buzzerLockedBy === socketId) {
    state.buzzerLockedBy = null;
  }
}

export function getTeamsList() {
  return Array.from(state.teams.values());
}

// Lógica de intento de pulsar el Buzzer ("¡ME LA SÉ!")
export function tryClaimBuzzer(socketId) {
  // Si alguien ya lo tiene o este equipo ya falló en esta pregunta, se rechaza
  if (state.buzzerLockedBy !== null) return false;
  if (state.buzzedTeamsInRound.has(socketId)) return false;

  state.buzzerLockedBy = socketId;
  state.buzzedTeamsInRound.add(socketId);
  return true;
}

export function releaseBuzzer() {
  state.buzzerLockedBy = null;
}

// Obtener la pregunta o clip actual
export function getCurrentItem() {
  const current = state.items[state.currentIndex];
  if (!current) return null;
  return current;
}

// Pasar a la siguiente ronda
export function nextRound() {
  state.buzzerLockedBy = null;
  state.buzzedTeamsInRound.clear();
  state.currentIndex = (state.currentIndex + 1) % state.items.length;
  return getCurrentItem();
}

// Modificar puntuación de un equipo
export function updateScore(socketId, deltaPoints) {
  const team = state.teams.get(socketId);
  if (team) {
    team.score += deltaPoints;
    return team;
  }
  return null;
}