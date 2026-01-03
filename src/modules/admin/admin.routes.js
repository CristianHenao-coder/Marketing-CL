import { Router } from 'express';
import multer from 'multer';
import { adminController } from './admin.controller.js';
import { authController } from './auth.controller.js';
import { authGuard } from '../../core/middlewares/auth.middleware.js';
import { loginLimiter } from '../../core/middlewares/rateLimit.middleware.js'; // Asumiendo que lo guardaste ahí

console.log('Valor de authGuard:', authGuard);
console.log('--- Verificación de adminController ---');
console.log('¿adminController existe?:', !!adminController);
console.log('Contenido de adminController:', Object.keys(adminController || {}));
console.log('¿listLinks es función?:', typeof adminController?.listLinks);

console.log('¿authController existe?:', !!authController);
console.log('¿renderLogin es función?:', typeof authController?.renderLogin);
console.log('¿login es función?:', typeof authController?.login);
console.log('¿logout es función?:', typeof authController?.logout);
console.log('¿loginLimiter es función?:', typeof loginLimiter);



const router = Router();
const upload = multer({ storage: multer.memoryStorage() });


router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// --- RUTAS PÚBLICAS DE ADMIN ---
router.get('/login', authController.renderLogin);
router.post('/login', loginLimiter, authController.login);
router.get('/logout', authController.logout);

// --- RUTAS PROTEGIDAS (Requieren authGuard) ---
router.post('/save', authGuard, upload.single('file'), adminController.createLink);
router.get('/list', authGuard, adminController.listLinks);

console.log('--- Verificación Final de Middlewares ---');
const uploadMiddleware = upload.single('file');
console.log('¿upload.single es función?:', typeof uploadMiddleware);
console.log('¿adminController.createLink es función?:', typeof adminController.createLink);

export default router;