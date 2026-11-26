export const GameState = {
    state: {
      teams: [],
      currentItem: null,
      lockedBy: null,
      gameMode: 'auto', // 'auto' o 'host'
      attemptedTeams: [] // IDs de equipos que ya fallaron en la ronda actual
    },
  
    addTeam(id, name) {
      const existing = this.state.teams.find(t => t.id === id);
      if (existing) {
        existing.name = name;
        return existing;
      }
      const newTeam = { id, name, score: 0 };
      this.state.teams.push(newTeam);
      return newTeam;
    },
  
    removeTeam(id) {
      this.state.teams = this.state.teams.filter(t => t.id !== id);
      if (this.state.lockedBy?.id === id) {
        this.state.lockedBy = null;
      }
    },
  
    startNewRound(item) {
      this.state.currentItem = item;
      this.state.lockedBy = null;
      this.state.attemptedTeams = [];
    },
  
    lockBuzzer(teamId) {
      // Si ya hay alguien respondiendo o el equipo ya intentó y falló, no puede pulsar
      if (this.state.lockedBy !== null) return null;
      if (this.state.attemptedTeams.includes(teamId)) return null;
  
      const team = this.state.teams.find(t => t.id === teamId);
      if (team) {
        this.state.lockedBy = team;
        return team;
      }
      return null;
    },
  
    registerFail(teamId) {
      if (!this.state.attemptedTeams.includes(teamId)) {
        this.state.attemptedTeams.push(teamId);
      }
      this.state.lockedBy = null;
    },
  
    releaseBuzzer() {
      this.state.lockedBy = null;
    },
  
    updateScore(teamId, delta) {
      const team = this.state.teams.find(t => t.id === teamId);
      if (team) {
        team.score = Math.max(0, team.score + delta); // No permitimos puntajes negativos
        return team;
      }
      return null;
    }
  };