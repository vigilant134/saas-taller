require('dotenv').config();   

const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/auth.routes');

app.use(express.json());
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  }
}));

app.use('/api/auth', authRoutes);

// estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// rutas
const indexRoutes = require('./routes/index.routes'); 
const apiRoutes = require('./routes/api.routes.js');
const citasRoutes = require('./routes/citas.routes.js');
const vehiculosRoutes = require('./routes/vehiculos.routes.js');
const serviciosRoutes = require('./routes/servicios.routes.js');
const clientesRoutes = require('./routes/clientes.routes.js');
const recordatoriosRoutes = require('./routes/recordatorios.routes.js');
const adminRoutes = require('./routes/admin.routes'); 

app.use('/', indexRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/recordatorios', recordatoriosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log('Servidor corriendo en puerto', port);
});