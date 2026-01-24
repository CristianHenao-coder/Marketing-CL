import { Router } from 'express';
import { publicController } from './public.controller.js';

const router = Router();

// 1. Rutas específicas (Deben ir primero)
router.get('/api/v1/gate/:id', publicController.getGate);
router.get('/loading/:id', publicController.renderLoading);

// 2. Ruta raíz (Para dominios personalizados)
router.get('/', publicController.handleRequest);

// 3. Ruta de Slug (Debe ir al FINAL)
// Se usa handleRequest que unifica la lógica de búsqueda y cloaking
router.get('/:slug', publicController.handleRequest);

export default router;