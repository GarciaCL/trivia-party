export const GameState = {
  roomPin: String(Math.floor(1000 + Math.random() * 9000)),
  phase: 'lobby', // 'lobby' | 'playing' | 'buzzed' | 'result' | 'podium'
  mode: 'auto',   // 'auto' | 'host'
  category: 'all', // 'all' | 'music' | 'movie'
  hostTeamId: null,
  hostVotes: {},
  teams: {},
  currentItem: null,
  buzzedTeamId: null,
  lockedTeams: [],
  roundCount: 0,

  resetToLobby(newPin = false) {
    if (newPin) {
      this.roomPin = String(Math.floor(1000 + Math.random() * 9000));
    }
    this.phase = 'lobby';
    this.mode = 'auto';
    this.category = 'all';
    this.hostVotes = {};
    this.currentItem = null;
    this.buzzedTeamId = null;
    this.lockedTeams = [];
    this.roundCount = 0;
    Object.values(this.teams).forEach(t => {
      t.score = 0;
    });
    const teamIds = Object.keys(this.teams);
    this.hostTeamId = teamIds[0] || null;
  },

  addTeam(socketId, name) {
    this.teams[socketId] = {
      id: socketId,
      name: name.trim().slice(0, 20),
      score: 0
    };
    if (!this.hostTeamId || !this.teams[this.hostTeamId]) {
      this.hostTeamId = socketId;
    }
    return this.teams[socketId];
  },

  removeTeam(socketId) {
    delete this.teams[socketId];
    delete this.hostVotes[socketId];
    if (this.hostTeamId === socketId) {
      this.hostTeamId = Object.keys(this.teams)[0] || null;
    }
    if (Object.keys(this.teams).length === 0) {
      this.resetToLobby(false);
    } else {
      this.evaluateHostMajority();
    }
  },

  castHostVote(voterId, targetId) {
    if (!this.teams[voterId] || !this.teams[targetId]) return null;
    // Permite cambiar de voto libremente en cualquier momento del lobby
    this.hostVotes[voterId] = targetId;
    return this.evaluateHostMajority();
  },

  evaluateHostMajority() {
    const teamIds = Object.keys(this.teams);
    if (teamIds.length === 0) {
      this.hostTeamId = null;
      return null;
    }
    const tally = {};
    Object.values(this.hostVotes).forEach(targetId => {
      if (this.teams[targetId]) tally[targetId] = (tally[targetId] || 0) + 1;
    });
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length > 0) {
      this.hostTeamId = entries[0][0];
    }
    return this.hostTeamId;
  },

  startNewRound(item) {
    this.phase = 'playing';
    this.currentItem = item;
    this.buzzedTeamId = null;
    this.lockedTeams = [];
    this.roundCount += 1;
  },

  getPublicState() {
    const tally = {};
    Object.values(this.hostVotes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    return {
      roomPin: this.roomPin,
      phase: this.phase,
      mode: this.mode,
      category: this.category,
      hostTeamId: this.hostTeamId,
      hostVotesTally: tally,
      teams: Object.values(this.teams).sort((a, b) => b.score - a.score),
      buzzedTeam: this.buzzedTeamId ? this.teams[this.buzzedTeamId] : null,
      roundCount: this.roundCount
    };
  }
};