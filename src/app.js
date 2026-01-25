import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts'; // 👈 Importante para el diseño unificado

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
app.use(expressLayouts); // 👈 Activamos los layouts
// app.set('layout', 'admin/layout'); // 👈 Definimos el layout por defecto para el admin

// 3. Middlewares de Infraestructura ⚙️
app.use(morgan('dev'));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Recursos Estáticos 📂
app.use(express.static(path.join(__dirname, '../public')));
app.use('/clook/gif', express.static(path.join(__dirname, '../gif')));

// ⚠️ NUEVO: Servir imágenes desde src/views/public/images para el Safety Gate
app.use('/images', express.static(path.join(__dirname, 'views/public/images')));

// 5. RUTAS DEL SISTEMA 🔐

// Panel de Administración (Login y Gestión)
app.use('/admin', adminRoutes);

// Capa Pública con Protección de Bots
// Usamos el BotShield aquí para proteger los links de tus clientes
app.use('/', botShield, publicRoutes);

// 6. Manejo de Errores Global 🛠️
app.use((err, req, res, next) => {
  console.error('❌ Error Crítico:', err.stack);
  // Si es un error de Multer lo manejamos con JSON si es necesario
  res.status(500).render('public/error', { 
    layout: false, // No usamos el layout de admin para errores públicos
    message: 'Algo salió mal en el sistema' 
  });
});

app.listen(env.PORT, () => {
  console.log(`🚀 LinkPro Empresarial en línea: Puerto ${env.PORT}`);
});

export default app;