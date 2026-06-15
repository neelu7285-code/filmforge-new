import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import scriptRoutes from './routes/scripts.js';
import { authenticate } from './middleware/auth.js';

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
// API Routes
// ---------------------------------------------------------------------------

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'filmforge-api', version: '0.1.0' });
});

// Auth routes (no auth needed)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/projects', authenticate, projectRoutes);

// Script routes (auth required)
app.use('/api/scripts', authenticate, scriptRoutes);

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