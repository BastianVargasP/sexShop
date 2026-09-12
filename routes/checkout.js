import express from 'express';
import * as checkoutController from '../controllers/checkoutController.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

router.get('/checkout', estaAutenticado, checkoutController.mostrarCheckout);
router.post('/checkout', estaAutenticado, checkoutController.procesarCheckout);

export default router;