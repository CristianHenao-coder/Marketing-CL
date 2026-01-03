import { Router } from 'express';
import { publicController } from './public.controller.js';

const router = Router();

// Tus rutas originales mapeadas al controlador
router.get('/:id', publicController.renderIndex);
router.get('/loading/:id', publicController.renderLoading);
router.get('/api/v1/gate/:id', publicController.getGate);

export default router;