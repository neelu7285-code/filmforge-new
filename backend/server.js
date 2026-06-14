import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (static)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------------------
// API Routes (placeholders — will be implemented as features are built)
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'filmforge-api', version: '0.1.0' });
});

// Auth placeholder
app.post('/api/auth/register', (_req, res) => {
  res.json({ message: 'Registration endpoint — coming soon' });
});

app.post('/api/auth/login', (_req, res) => {
  res.json({ message: 'Login endpoint — coming soon' });
});

// Scripts placeholder
app.post('/api/scripts/upload', (_req, res) => {
  res.json({ message: 'Script upload endpoint — coming soon' });
});

app.get('/api/scripts/:id', (_req, res) => {
  res.json({ message: 'Script detail endpoint — coming soon' });
});

// Projects placeholder
app.get('/api/projects', (_req, res) => {
  res.json({ message: 'Projects list endpoint — coming soon', projects: [] });
});

app.post('/api/projects', (_req, res) => {
  res.json({ message: 'Project creation endpoint — coming soon' });
});

// Breakdowns placeholder
app.get('/api/projects/:id/breakdowns', (_req, res) => {
  res.json({ message: 'Breakdowns endpoint — coming soon' });
});

// ---------------------------------------------------------------------------
// Serve built frontend in production
// ---------------------------------------------------------------------------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[FilmForge API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 FilmForge API running on http://0.0.0.0:${PORT}`);
});