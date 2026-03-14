import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import i18n from './config/i18n.js'; // 👈 Importamos i18n

import { env } from './config/env.js';
import publicRoutes from './modules/public/public.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { botShield } from './core/middlewares/botShield.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 1. Configuración de Red y Seguridad 🌐
app.set('trust proxy', 1);

// 2. Configuración del Motor de Vistas y Layouts 🖼️
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// 3. Middlewares de Infraestructura ⚙️
app.use(morgan('dev'));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(i18n.init); // 👈 Inicializamos i18n aquí (antes de las rutas)

// 4. Recursos Estáticos 📂
app.use(express.static(path.join(__dirname, '../public')));
app.use('/clook/gif', express.static(path.join(__dirname, '../gif')));
app.use('/images', express.static(path.join(__dirname, 'views/public/images')));

// 5. RUTAS DEL SISTEMA 🔐

import apiRoutes from './modules/api/api.routes.js';

// ... (existing imports)

// ...

// Panel de Administración
app.use('/admin', adminRoutes);

// API para Sistemas Externos (OnlyProgram)
app.use('/api/v1', apiRoutes);

// Capa Pública con Protección de Bots
app.use('/', botShield, publicRoutes);

// 6. Manejo de Errores Global 🛠️
app.use((err, req, res, next) => {
  console.error('❌ Error Crítico:', err.stack);
  
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render('public/error', {
    layout: false,
    message: 'Algo salió mal en el sistema'
  });
});



export default app;