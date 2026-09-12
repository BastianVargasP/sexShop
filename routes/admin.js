import express from 'express';
import { pool } from '../helpers/database.js';
import { estaAutenticado, esAdmin } from '../middlewares/auth.js';
import * as adminController from '../controllers/adminController.js';
import * as productosAdminController from '../controllers/adminProductosController.js';
import * as categoriasAdminController from '../controllers/adminCategoriasController.js';
import * as pedidosAdminController from '../controllers/adminPedidosController.js';
import * as inventarioAdminController from '../controllers/adminInventarioController.js';
import * as clientesAdminController from '../controllers/adminClientesController.js';

const router = express.Router();

// Todas las rutas /admin/* requieren sesión Y rol admin
router.use(estaAutenticado, esAdmin);

router.use(async (req, res, next) => {
    try {
        const resultado = await pool.query(
            "SELECT COUNT(*) AS total FROM pedidos WHERE estado = 'procesando'"
        );
        res.locals.pedidosPendientes = Number(resultado.rows[0].total);
    } catch (error) {
        res.locals.pedidosPendientes = 0;
    }
    next();
});

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

router.get('/clientes', clientesAdminController.listarClientes);
router.get('/clientes/:id/detalle', clientesAdminController.obtenerDetalleCliente);
router.post('/clientes/:id/bloquear', clientesAdminController.alternarBloqueo);
router.post('/clientes/:id/eliminar', clientesAdminController.eliminarCliente);

router.get('/pedidos', pedidosAdminController.listarPedidos);
router.post('/pedidos/:id/estado', pedidosAdminController.actualizarEstado);
router.post('/pedidos/:id/pago', pedidosAdminController.actualizarEstadoPago);

router.get('/inventario', inventarioAdminController.mostrarInventario);
router.post('/inventario/movimiento', inventarioAdminController.registrarMovimiento);

router.get('/configuracion', adminController.mostrarConfiguracion);

export default router;