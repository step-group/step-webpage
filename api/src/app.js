const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { restrictExternals } = require('./middleware/auth');

const authRoutes        = require('./routes/auth');
const adminRoutes       = require('./routes/admin');
const experimentRoutes  = require('./routes/experiments');
const templateRoutes    = require('./routes/templates');
const resourceRoutes    = require('./routes/resources');
const datasetRoutes     = require('./routes/datasets');
const publicationRoutes = require('./routes/publications');
const equipmentRoutes   = require('./routes/equipment');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// External users (outside the lab) may only log in, read/update their own profile and use the
// equipment calendar. /auth/activity (experiments, datasets, publications) stays closed to them.
app.use('/api', restrictExternals(['/auth/login', '/auth/register', '/auth/me', '/auth/profile', '/equipment']));

app.use('/api/auth',         authRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/experiments',  experimentRoutes);
app.use('/api/templates',    templateRoutes);
app.use('/api/resources',    resourceRoutes);
app.use('/api',              datasetRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/equipment',    equipmentRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
