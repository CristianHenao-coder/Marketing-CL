
import { Router } from 'express';
import { analyzeTraffic } from './traffic.controller.js';

const router = Router();

router.post('/analyze-traffic', analyzeTraffic);

export default router;
