import express from 'express';
import { estaAutenticado, esAdmin } from '../middlewares/auth.js';
import * as adminController from '../controllers/adminController.js';
import * as productosAdminController from '../controllers/adminProductosController.js';
import * as categoriasAdminController from '../controllers/adminCategoriasController.js';

const router = express.Router();

// Todas las rutas /admin/* requieren sesión Y rol admin
router.use(estaAutenticado, esAdmin);

router.get('/', adminController.mostrarDashboard);

router.get('/productos', productosAdminController.listarProductos);
router.post('/productos', productosAdminController.crearProducto);
router.get('/productos/:id/editar', productosAdminController.mostrarFormularioEditar);
router.post('/productos/:id/editar', productosAdminController.actualizarProducto);
router.post('/productos/:id/activar', productosAdminController.alternarActivo);
router.post('/productos/:id/eliminar', productosAdminController.eliminarProducto);

router.get('/categorias', categoriasAdminController.listarCategorias);
router.post('/categorias', categoriasAdminController.crearCategoria);
router.get('/categorias/:id/editar', categoriasAdminController.mostrarFormularioEditarCategoria);
router.post('/categorias/:id/editar', categoriasAdminController.actualizarCategoria);
router.post('/categorias/:id/activar', categoriasAdminController.alternarActivoCategoria);
router.post('/categorias/:id/eliminar', categoriasAdminController.eliminarCategoria);
router.post('/categorias/orden', categoriasAdminController.actualizarOrdenCategorias);

router.post('/subcategorias', categoriasAdminController.crearSubcategoria);
router.get('/subcategorias/:id/editar', categoriasAdminController.mostrarFormularioEditarSubcategoria);
router.post('/subcategorias/:id/editar', categoriasAdminController.actualizarSubcategoria);
router.post('/subcategorias/:id/activar', categoriasAdminController.alternarActivoSubcategoria);
router.post('/subcategorias/:id/eliminar', categoriasAdminController.eliminarSubcategoria);
router.post('/subcategorias/orden', categoriasAdminController.actualizarOrdenSubcategorias);

router.get('/cupones', adminController.mostrarCupones);
router.get('/clientes', adminController.mostrarClientes);
router.get('/pedidos', adminController.mostrarPedidos);
router.get('/inventario', adminController.mostrarInventario);
router.get('/configuracion', adminController.mostrarConfiguracion);

export default router;