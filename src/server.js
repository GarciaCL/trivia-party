import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { initGameSockets } from './sockets/gameSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.get('/tv', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'tv', 'index.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'play', 'index.html'));
});

app.get('/admin-content', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

// La URL principal abre siempre la pantalla anfitriona
app.get('/', (req, res) => {
  res.redirect('/tv');
});

initGameSockets(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Trivia Party activo en el puerto ${PORT}`);
});