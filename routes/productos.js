import express from 'express';
import * as productosController from '../controllers/productosController.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

router.get('/productos', productosController.listarProductos);
router.get('/productos/:id', productosController.verProducto);
router.post('/productos/:id/favorito', estaAutenticado, productosController.agregarFavorito);
router.post('/productos/:id/quitar-favorito', estaAutenticado, productosController.quitarFavorito);

export default router;