require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./database/init');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const profesionalesRoutes = require('./routes/profesionales');
const activosRoutes = require('./routes/activos');
const actasRoutes = require('./routes/actas');

const app = express();
const PORT = process.env.PORT || 3004;
app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'http://localhost:5190',
  'http://127.0.0.1:5190',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (origin.endsWith('.onrender.com')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Demasiados intentos, espere 15 minutos' });
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/profesionales', profesionalesRoutes);
app.use('/api/activos', activosRoutes);
app.use('/api/actas', actasRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo supera el tamaño máximo permitido.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Backend Control de Activos JEJ corriendo en puerto ${PORT} — DB: PostgreSQL (Aiven)`);
  });
}
startServer();

module.exports = app;
