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
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (!geminiKey && !groqKey) {
    return res.status(500).json({ error: 'No se detectó GEMINI_API_KEY ni GROQ_API_KEY en Render.' });
  }

  const kind = type === 'movie' ? 'película o serie' : 'canción con su artista';
  const prompt = `Para una trivia sobre la ${kind} "${title}", genera exactamente 3 respuestas incorrectas pero plausibles del mismo estilo, época o género. Devuelve SOLO un arreglo JSON de 3 strings, sin texto extra. Ejemplo: ["Opción A", "Opción B", "Opción C"]`;

  const errors = [];

  // 1. Prioridad: Groq (ultra rápido, < 1s)
  if (groqKey) {
    for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
          })
        });
        const data = await response.json();
        if (response.ok) {
          const raw = data?.choices?.[0]?.message?.content || '[]';
          const match = raw.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(match ? match[0] : raw);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return res.json({ distractors: parsed.slice(0, 3), provider: `Groq (${model})` });
          }
        } else {
          errors.push(`Groq ${model}: ${data?.error?.message || response.status}`);
        }
      } catch (err) {
        errors.push(`Groq ${model}: ${err.message}`);
      }
    }
  } else {
    errors.push('GROQ_API_KEY vacía en Render');
  }

  // 2. Respaldo: Google Gemini
  if (geminiKey) {
    for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        const data = await response.json();
        if (response.ok) {
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          const match = raw.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(match ? match[0] : raw);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return res.json({ distractors: parsed.slice(0, 3), provider: `Gemini (${model})` });
          }
        } else {
          errors.push(`Gemini ${model}: ${data?.error?.message || response.status}`);
        }
      } catch (err) {
        errors.push(`Gemini ${model}: ${err.message}`);
      }
    }
  }

  console.error('❌ Fallo motores IA:', errors);
  res.status(503).json({ error: errors.join(' | ') });
});

app.get('/', (req, res) => res.redirect('/tv'));

initGameSockets(io);

await ContentData.init();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Trivia Party activo en el puerto ${PORT}`);
});