import { Router } from 'express';
import { publicController } from './public.controller.js';
import { telegramController } from '../admin/telegram.controller.js'; // 👈 Importamos el controlador de Telegram

const router = Router();

// 1. Rutas específicas (Deben ir primero)
router.get('/api/v1/gate/:id', publicController.getGate);
router.get('/loading/:id', publicController.renderLoading);
router.get('/challenge', publicController.renderChallenge);

// 2. Ruta de Rotación de Telegram (Pública)
// Esta ruta maneja la lógica de rotación y redirección
router.get('/t/:slug', telegramController.handleRotation);

// 3. Ruta raíz (Para dominios personalizados)
router.get('/', publicController.handleRequest);

// 4. Ruta de Slug (Debe ir al FINAL)
// Se usa handleRequest que unifica la lógica de búsqueda y cloaking
router.get('/:slug', publicController.handleRequest);

export default router;