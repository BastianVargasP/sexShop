import express from 'express';
import * as carritoController from '../controllers/carritoController.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

router.post('/productos/:id/carrito', estaAutenticado, carritoController.agregarAlCarrito);
router.get('/carrito', estaAutenticado, carritoController.verCarrito);
router.post('/carrito/:id/incrementar', estaAutenticado, carritoController.incrementar);
router.post('/carrito/:id/decrementar', estaAutenticado, carritoController.decrementar);
router.post('/carrito/:id/eliminar', estaAutenticado, carritoController.eliminarItem);

export default router;