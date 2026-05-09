require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes       = require('./routes/auth');
const adminRoutes      = require('./routes/admin');
const experimentRoutes = require('./routes/experiments');
const templateRoutes   = require('./routes/templates');
const resourceRoutes   = require('./routes/resources');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',        authRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/templates',   templateRoutes);
app.use('/api/resources',   resourceRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));
