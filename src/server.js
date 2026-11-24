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
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(500).json({ error: 'Falta GEMINI_API_KEY en Render.' });

  const kind = type === 'movie' ? 'película o serie' : 'canción con su artista';
  const prompt = `Para una trivia sobre la ${kind} "${title}", genera exactamente 3 respuestas incorrectas pero plausibles del mismo estilo, época o género. Devuelve SOLO un arreglo JSON de 3 strings.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Error en la API de Gemini.' });
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : raw);
    res.json({ distractors: parsed.slice(0, 3) });
  } catch (err) {
    res.status(500).json({ error: `Fallo al procesar respuesta IA: ${err.message}` });
  }
});

app.get('/', (req, res) => res.redirect('/tv'));

initGameSockets(io);

await ContentData.init();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Trivia Party activo en el puerto ${PORT}`);
});