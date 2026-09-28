import geminiVoiceHandler from './api/gemini/generate';
import geminiAlignHandler from './api/gemini/align-project';
import geminiKeyHandler from './api/gemini/key';
import voiceStatusHandler from './api/elevenlabs/status';
import voiceListHandler from './api/elevenlabs/voices';
import alignHandler from './api/elevenlabs/align';
import elevenLabsProjectAlignHandler from './api/elevenlabs/align-project';
import analyticsHandler from './api/admin/analytics';
import storageHandler from './api/admin/storage';
import setRoleHandler from './api/admin/set-role';
import { requireMember } from './server/auth';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Security headers for the Node server (npm start). Framing stays allowed here because
// AI Studio previews this server in a frame; the Vercel site forbids framing (vercel.json).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)');
  next();
});
app.use(express.json({ limit: '50mb' }));

app.get('/api/elevenlabs/status', voiceStatusHandler);
app.get('/api/elevenlabs/voices', voiceListHandler);
app.post('/api/gemini/generate', geminiVoiceHandler);
app.post('/api/gemini/align-project', geminiAlignHandler);
app.all('/api/gemini/key', geminiKeyHandler);
app.post('/api/elevenlabs/align', alignHandler);
app.post('/api/elevenlabs/align-project', elevenLabsProjectAlignHandler);
// Same handlers Vercel serves from api/, so the admin panel also works in local development.
app.get('/api/admin/analytics', analyticsHandler);
app.all('/api/admin/storage', storageHandler);
app.post('/api/admin/set-role', setRoleHandler);
app.use('/api', async(req,res,next)=>{if(await requireMember(req,res))next();});

// Production / Dev Vite static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teacher Studio Server running on port ${PORT}`);
  });
}

startServer();
