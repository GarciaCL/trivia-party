import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { initGameSockets } from './sockets/gameSocket.js';
import { ContentData } from './state/contentData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.get('/tv', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'tv', 'index.html')));
app.get('/play', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'play', 'index.html')));
app.get('/admin-content', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));

// API CRUD del Catálogo
app.get('/api/content', async (req, res) => res.json(await ContentData.getAll()));
app.post('/api/content', async (req, res) => res.status(201).json(await ContentData.addItem(req.body)));
app.put('/api/content/:id', async (req, res) => res.json(await ContentData.updateItem(req.params.id, req.body)));
app.delete('/api/content/:id', async (req, res) => {
  await ContentData.deleteItem(req.params.id);
  res.json({ ok: true });
});

// API IA: Generar 3 distractores basados en el título
app.post('/api/generate-options', async (req, res) => {
  const { title, type } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta GEMINI_API_KEY en el servidor.' });

  const kind = type === 'movie' ? 'película o serie' : 'canción con su artista';
  const prompt = `Para una trivia sobre la ${kind} "${title}", genera exactamente 3 respuestas incorrectas pero plausibles del mismo estilo, época o género. Devuelve SOLO un arreglo JSON válido de 3 strings, sin markdown ni texto extra. Ejemplo: ["Opción A", "Opción B", "Opción C"]`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    res.json({ distractors: JSON.parse(clean).slice(0, 3) });
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron generar opciones con IA.' });
  }
});

app.get('/', (req, res) => res.redirect('/tv'));

initGameSockets(io);

await ContentData.init();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Trivia Party activo en el puerto ${PORT}`);
});