import express from 'express';
import { estaAutenticado, esAdmin } from '../middlewares/auth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// Todas las rutas /admin/* requieren sesión Y rol admin
router.use(estaAutenticado, esAdmin);

router.get('/', adminController.mostrarDashboard);
router.get('/productos', adminController.mostrarProductos);
router.get('/categorias', adminController.mostrarCategorias);
router.get('/cupones', adminController.mostrarCupones);
router.get('/clientes', adminController.mostrarClientes);
router.get('/pedidos', adminController.mostrarPedidos);
router.get('/inventario', adminController.mostrarInventario);
router.get('/configuracion', adminController.mostrarConfiguracion);

export default router;