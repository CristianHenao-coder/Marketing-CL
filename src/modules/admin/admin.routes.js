// src/modules/admin/admin.routes.js
import { Router } from 'express';
import multer from 'multer';
import { adminController } from './admin.controller.js';
import { authController } from './auth.controller.js';
import { telegramController } from './telegram.controller.js'; // 👈 Importamos el nuevo controlador
import { authGuard } from '../../core/middlewares/auth.middleware.js';
import { loginLimiter } from '../../core/middlewares/rateLimit.middleware.js';

const router = Router();

/**
 * 🔧 Configuración de Multer (subida de imágenes a memoria)
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, webp)'), false);
    }
  }
});

/**
 * 🧯 Manejo específico de errores de subida
 */
const handleUploadError = (err, req, res, next) => {
  if (err && (err instanceof multer.MulterError || err.message?.includes('imágenes'))) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return next(err);
};

/**
 * 🚫 Desactivar caché para el panel admin
 */
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

/* =========================================================================
 *  RUTAS PÚBLICAS (NO REQUIEREN LOGIN)
 * ========================================================================= */

/**
 * Login (GET) – muestra el formulario
 */
router.get('/login', authController.renderLogin);

/**
 * Login (POST) – procesa credenciales
 * Aplica rate-limit para evitar fuerza bruta
 */
router.post('/login', loginLimiter, authController.login);

/**
 * Logout – borra cookie y redirige a /login
 */
router.get('/logout', authController.logout);

/* =========================================================================
 *  A PARTIR DE AQUÍ: TODO REQUIERE ESTAR LOGUEADO
 * ========================================================================= */

router.use(authGuard);
router.post('/clients/update/:id', adminController.updateClient);
router.post('/clients/delete/:id', adminController.deleteClient);

/**
 * Dashboard principal – KPIs globales
 * GET /admin/dashboard
 */
router.get('/dashboard', adminController.renderDashboard);

/**
 * Listado de clientes
 * GET /admin/clients
 */
router.get('/clients', adminController.renderClients);

/**
 * Perfil detallado de un cliente
 * GET /admin/clients/profile/:id
 */
router.get('/clients/profile/:id', adminController.renderClientProfile);

/**
 * Listado / creación de Smart Links
 * GET /admin/links
 */
router.get('/links', adminController.renderLinks);

/**
 * Compatibilidad antigua: /admin/list → /admin/links
 */
router.get('/list', (req, res) => {
  return res.redirect('/admin/links');
});

/* =========================================================================
 *  ACCIONES SOBRE LINKS
 * ========================================================================= */

/**
 * Crear nuevo Smart Link (con foto opcional)
 * POST /admin/save
 */
router.post(
  '/save',
  upload.single('file'),
  handleUploadError,
  adminController.createLink
);

/**
 * Toggle estado comercial (ON/OFF – pending_payment / active)
 * POST /admin/links/toggle/:id
 */
router.post('/links/toggle/:id', adminController.toggleService);

/**
 * Eliminar link
 * DELETE /admin/links/:id
 */
router.delete('/links/:id', adminController.deleteLink);

/**
 * Toggle campo is_active (encendido/apagado técnico)
 * POST /admin/links/:id/toggle-active
 */
router.post('/links/:id/toggle-active', adminController.toggleLinkActive);

/**
 * Editar campos básicos de un link desde el modal del perfil
 * POST /admin/links/edit/:id
 */
router.post('/links/edit/:id', adminController.updateLink);

/**
 * Toggle rápido de escudos (Meta/TikTok)
 * PATCH /admin/links/:id/toggle-shield
 */
router.patch('/links/:id/toggle-shield', adminController.toggleShield);


/* =========================================================================
 *  GESTIÓN DE TELEGRAM (ROTADOR)
 * ========================================================================= */
router.get('/telegram/status/:linkId', telegramController.getBotsStatus);
router.post('/telegram/add/:linkId', telegramController.addBot);
router.post('/telegram/edit/:botId', telegramController.editBot);
router.delete('/telegram/delete/:botId', telegramController.deleteBot);
router.post('/telegram/limit/:linkId', telegramController.updateLimit);
router.post('/telegram/capacity/:linkId', telegramController.updateMaxCapacity); // 👈 Nueva ruta
router.post('/telegram/reset/:linkId', telegramController.resetStats);


export default router;
