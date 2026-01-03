import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import publicRoutes from './modules/public/public.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { botShield } from './core/middlewares/botShield.middleware.js';
import { authGuard } from './core/middlewares/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === "production";

app.set('trust proxy', 1);
app.set("trust proxy", isProd ? 1 : false);
// 1. Configuración del Motor de Vistas 🖼️
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', true); 

// 2. Middlewares de Infraestructura ⚙️
app.use(morgan('dev'));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Recursos Públicos (Imágenes, CSS, GIFs) 📂
app.use('/clook/gif', express.static(path.join(__dirname, '../gif')));
app.use(express.static(path.join(__dirname, '../public')));

// 4. RUTAS DE ADMINISTRACIÓN Y PANEL 🔐
// Nota: 'adminRoutes' ahora maneja internamente el login (público) 
// y las acciones de base de datos (protegidas).
app.use('/admin', adminRoutes); 
app.use('/api', authGuard, adminRoutes); // Protegemos la API completa

// Acceso al Panel de Control (Solo con sesión activa)
app.get('/admin/list', authGuard, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/private/private-link.html'));
});

// 5. CAPA DE SEGURIDAD PARA LINKS PÚBLICOS 🛡️
// El BotShield solo actúa sobre las rutas que tus clientes visitan
app.use('/', botShield, publicRoutes); 

// 6. Manejo de Errores Global 🛠️
app.use((err, req, res, next) => {
  console.error('❌ Error Crítico:', err.stack);
  res.status(500).render('public/error', { message: 'Algo salió mal en el sistema' });
});

app.listen(env.PORT, () => {
  console.log(`🚀 Sistema Empresarial en línea: Puerto ${env.PORT}`);
});


export default app;