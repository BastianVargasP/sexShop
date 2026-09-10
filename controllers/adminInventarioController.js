import { pool, getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const TIPOS_VALIDOS = ['entrada', 'salida', 'ajuste'];

const obtenerNombreActor = (req) =>
    req.session.usuario ? `${req.session.usuario.nombre} ${req.session.usuario.apellido}` : 'Admin';

/**
 * Estado calculado a partir de stock disponible (stock - reservado en carritos)
 * y el umbral stock_minimo definido en cada producto.
 */
const calcularEstado = (disponible, stockMinimo) => {
    if (disponible <= 0) return 'agotado';
    if (disponible <= Math.ceil(stockMinimo / 2)) return 'critico';
    if (disponible <= stockMinimo) return 'bajo';
    return 'disponible';
};

/* ==================== Listado de existencias + movimientos ==================== */

export const mostrarInventario = async (req, res, next) => {
    try {
        const { estado, categoriaId, busqueda, tipoMovimiento } = req.query;

        const productosResult = await pool.query(
            `SELECT p.id, p.nombre, p.sku, p.imagen, p.stock, p.stock_minimo,
                    c.nombre AS categoria_nombre, s.nombre AS subcategoria_nombre,
                    COALESCE(r.reservado, 0) AS reservado
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
             LEFT JOIN (
                 SELECT producto_id, SUM(cantidad) AS reservado
                 FROM carrito_items GROUP BY producto_id
             ) r ON r.producto_id = p.id
             WHERE p.activo = TRUE
             ORDER BY p.nombre ASC`
        );

        let productos = productosResult.rows.map((p) => {
            const disponible = Math.max(0, p.stock - Number(p.reservado));
            return { ...p, disponible, estadoCalculado: calcularEstado(disponible, p.stock_minimo) };
        });

        // Métricas globales (antes de aplicar filtros de tabla, para que las tarjetas resuman todo el catálogo)
        const metricas = productos.reduce(
            (acc, p) => {
                acc[p.estadoCalculado] += 1;
                acc.totalDisponible += p.disponible;
                return acc;
            },
            { disponible: 0, bajo: 0, critico: 0, agotado: 0, totalDisponible: 0 }
        );

        if (estado) {
            productos = productos.filter((p) => p.estadoCalculado === estado);
        }
        if (categoriaId) {
            productos = productos.filter((p) => String(p.categoria_id) === String(categoriaId));
        }
        if (busqueda) {
            const termino = busqueda.toLowerCase();
            productos = productos.filter((p) =>
                p.nombre.toLowerCase().includes(termino) || (p.sku || '').toLowerCase().includes(termino)
            );
        }

        const condicionesMov = [];
        const valoresMov = [];
        if (tipoMovimiento) {
            valoresMov.push(tipoMovimiento);
            condicionesMov.push(`m.tipo = $${valoresMov.length}`);
        }
        const whereMov = condicionesMov.length ? `WHERE ${condicionesMov.join(' AND ')}` : '';

        const movimientosResult = await pool.query(
            `SELECT m.*, p.nombre AS producto_nombre, p.sku AS producto_sku
             FROM movimientos_inventario m
             JOIN productos p ON p.id = m.producto_id
             ${whereMov}
             ORDER BY m.created_at DESC
             LIMIT 50`,
            valoresMov
        );

        const categoriasResult = await pool.query('SELECT id, nombre FROM categorias WHERE activa = TRUE ORDER BY nombre ASC');

        res.render('admin/inventario', {
            titulo: 'Inventario',
            productos,
            movimientos: movimientosResult.rows,
            categorias: categoriasResult.rows,
            metricas,
            filtros: { estado: estado || '', categoriaId: categoriaId || '', busqueda: busqueda || '', tipoMovimiento: tipoMovimiento || '' }
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/inventario - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Registrar movimiento (entrada / salida / ajuste) ==================== */

export const registrarMovimiento = async (req, res, next) => {
    const { productoId, tipo, cantidad, motivo } = req.body;

    if (!productoId || !TIPOS_VALIDOS.includes(tipo) || !motivo || !motivo.trim()) {
        return res.status(400).render('error', {
            ok: false,
            mensaje: 'Producto, tipo de movimiento y motivo son obligatorios.',
            error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
        });
    }

    const cantidadNum = Number(cantidad);
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).render('error', {
            ok: false,
            mensaje: 'La cantidad debe ser un número entero mayor a 0.',
            error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
        });
    }

    const conexion = await getDbClient();
    try {
        await conexion.query('BEGIN');

        const productoResult = await conexion.query('SELECT stock FROM productos WHERE id = $1 FOR UPDATE', [productoId]);
        if (productoResult.rows.length === 0) {
            await conexion.query('ROLLBACK');
            return next();
        }

        const stockAnterior = productoResult.rows[0].stock;
        let stockNuevo;

        if (tipo === 'entrada') {
            stockNuevo = stockAnterior + cantidadNum;
        } else if (tipo === 'salida') {
            stockNuevo = stockAnterior - cantidadNum;
        } else {
            // ajuste: la "cantidad" es el nuevo stock absoluto, no un delta
            stockNuevo = cantidadNum;
        }

        if (stockNuevo < 0) {
            await conexion.query('ROLLBACK');
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'El stock resultante no puede ser negativo.',
                error: { status: 400, stack: 'Revisa la cantidad ingresada.' }
            });
        }

        await conexion.query('UPDATE productos SET stock = $1 WHERE id = $2', [stockNuevo, productoId]);

        await conexion.query(
            `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, actor)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [productoId, tipo, tipo === 'ajuste' ? Math.abs(stockNuevo - stockAnterior) : cantidadNum, stockAnterior, stockNuevo, motivo.trim(), obtenerNombreActor(req)]
        );

        await conexion.query('COMMIT');

        registrarActividad(`📦 POST /admin/inventario/movimiento - ÉXITO: producto #${productoId} ${tipo} (${stockAnterior} -> ${stockNuevo}).`);
        res.redirect('/admin/inventario?vista=movimientos');
    } catch (error) {
        try { await conexion.query('ROLLBACK'); } catch (_) { /* ignorado */ }
        registrarActividad(`📦❌ POST /admin/inventario/movimiento - ERROR: ${error.message}`);
        next(error);
    } finally {
        conexion.release();
    }
};