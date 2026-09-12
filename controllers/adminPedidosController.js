import { pool, getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const ESTADOS_VALIDOS = ['procesando', 'enviado', 'entregado', 'devuelto', 'cancelado'];
const ESTADOS_PAGO_VALIDOS = ['pendiente', 'pagado', 'rechazado', 'reembolsado'];
const ESTADOS_QUE_REPONEN_STOCK = ['cancelado', 'devuelto'];
const PAGE_SIZE = 20;

const obtenerNombreActor = (req) =>
    req.session.usuario ? `${req.session.usuario.nombre} ${req.session.usuario.apellido}` : 'Admin';

/* ==================== Actualizar estado del pedido ==================== */

export const actualizarEstado = async (req, res) => {
    const { estado } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ ok: false, error: 'Estado inválido.' });
    }

    const conexion = await getDbClient();
    try {
        await conexion.query('BEGIN');

        const pedidoActual = await conexion.query(
            'SELECT id, estado, estado_pago, numero_pedido, stock_repuesto FROM pedidos WHERE id = $1 FOR UPDATE',
            [req.params.id]
        );
        if (pedidoActual.rows.length === 0) {
            await conexion.query('ROLLBACK');
            return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
        }

        const { estado: estadoAnterior, estado_pago, numero_pedido, stock_repuesto } = pedidoActual.rows[0];

        await conexion.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, req.params.id]);

        // Reponemos stock solo si el pedido entra a cancelado/devuelto por primera vez
        // (evita doble reposición si el admin cambia entre cancelado <-> devuelto, o guarda el mismo valor dos veces)
        const debeReponer = ESTADOS_QUE_REPONEN_STOCK.includes(estado) && !stock_repuesto;

        if (debeReponer) {
            const itemsResult = await conexion.query(
                'SELECT producto_id, producto_nombre, cantidad FROM pedido_items WHERE pedido_id = $1',
                [req.params.id]
            );

            for (const item of itemsResult.rows) {
                const productoResult = await conexion.query(
                    'SELECT stock FROM productos WHERE id = $1 FOR UPDATE',
                    [item.producto_id]
                );
                if (productoResult.rows.length === 0) continue; // producto eliminado desde entonces

                const stockAnterior = productoResult.rows[0].stock;
                const stockNuevo = stockAnterior + item.cantidad;

                await conexion.query('UPDATE productos SET stock = $1 WHERE id = $2', [stockNuevo, item.producto_id]);

                await conexion.query(
                    `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, actor)
                     VALUES ($1, 'devolucion', $2, $3, $4, $5, $6)`,
                    [
                        item.producto_id,
                        item.cantidad,
                        stockAnterior,
                        stockNuevo,
                        `Reposición automática - Pedido ${numero_pedido} marcado como "${estado}"`,
                        obtenerNombreActor(req)
                    ]
                );
            }

            await conexion.query('UPDATE pedidos SET stock_repuesto = TRUE WHERE id = $1', [req.params.id]);
        }

        await conexion.query(
            `INSERT INTO pedidos_historial (pedido_id, estado, estado_pago, actor)
             VALUES ($1, $2, $3, $4)`,
            [req.params.id, estado, estado_pago, obtenerNombreActor(req)]
        );

        await conexion.query('COMMIT');

        registrarActividad(`📦 POST /admin/pedidos/${req.params.id}/estado - ÉXITO: pedido ${numero_pedido} -> ${estado}${debeReponer ? ' (stock repuesto)' : ''}.`);
        res.json({ ok: true, estado });
    } catch (error) {
        try { await conexion.query('ROLLBACK'); } catch (_) { /* ignorado */ }
        registrarActividad(`📦❌ POST /admin/pedidos/${req.params.id}/estado - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar el estado del pedido.' });
    } finally {
        conexion.release();
    }
};

/* ==================== Actualizar estado de pago ==================== */

export const actualizarEstadoPago = async (req, res) => {
    try {
        const { estadoPago } = req.body;
        if (!ESTADOS_PAGO_VALIDOS.includes(estadoPago)) {
            return res.status(400).json({ ok: false, error: 'Estado de pago inválido.' });
        }

        const resultado = await pool.query(
            'UPDATE pedidos SET estado_pago = $1 WHERE id = $2 RETURNING id, estado, numero_pedido',
            [estadoPago, req.params.id]
        );
        if (resultado.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });
        }

        const { estado, numero_pedido } = resultado.rows[0];
        await pool.query(
            `INSERT INTO pedidos_historial (pedido_id, estado, estado_pago, actor)
             VALUES ($1, $2, $3, $4)`,
            [req.params.id, estado, estadoPago, obtenerNombreActor(req)]
        );

        registrarActividad(`📦 POST /admin/pedidos/${req.params.id}/pago - ÉXITO: pedido ${numero_pedido} pago -> ${estadoPago}.`);
        res.json({ ok: true, estadoPago });
    } catch (error) {
        registrarActividad(`📦❌ POST /admin/pedidos/${req.params.id}/pago - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar el estado de pago.' });
    }
};

/* ==================== Listado con filtros y paginación (sin cambios) ==================== */

export const listarPedidos = async (req, res, next) => {
    try {
        const { estado, estadoPago, busqueda, desde, hasta, pagina } = req.query;
        const condiciones = [];
        const valores = [];

        if (estado) {
            valores.push(estado);
            condiciones.push(`p.estado = $${valores.length}`);
        }
        if (estadoPago) {
            valores.push(estadoPago);
            condiciones.push(`p.estado_pago = $${valores.length}`);
        }
        if (busqueda) {
            valores.push(`%${busqueda}%`);
            condiciones.push(
                `(p.numero_pedido ILIKE $${valores.length} OR cl.nombre ILIKE $${valores.length} OR cl.apellido ILIKE $${valores.length} OR cl.email ILIKE $${valores.length})`
            );
        }
        if (desde) {
            valores.push(desde);
            condiciones.push(`p.created_at >= $${valores.length}::date`);
        }
        if (hasta) {
            valores.push(hasta);
            condiciones.push(`p.created_at < $${valores.length}::date + INTERVAL '1 day'`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const paginaActual = Math.max(1, parseInt(pagina, 10) || 1);
        const offset = (paginaActual - 1) * PAGE_SIZE;

        const totalResult = await pool.query(
            `SELECT COUNT(*) AS total FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id ${where}`,
            valores
        );
        const total = Number(totalResult.rows[0].total);
        const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

        const pedidosResult = await pool.query(
            `SELECT p.*, cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido,
                    cl.email AS cliente_email, cl.telefono AS cliente_telefono,
                    d.direccion, d.ciudad, d.comuna, d.region,
                    m.marca, m.ultimos_digitos
             FROM pedidos p
             JOIN clientes cl ON cl.id = p.cliente_id
             LEFT JOIN direcciones d ON d.id = p.direccion_id
             LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
             ${where}
             ORDER BY p.created_at DESC
             LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
            valores
        );

        const pedidos = pedidosResult.rows;
        const pedidoIds = pedidos.map((p) => p.id);

        let itemsPorPedido = {};
        let historialPorPedido = {};

        if (pedidoIds.length > 0) {
            const itemsResult = await pool.query(
                'SELECT * FROM pedido_items WHERE pedido_id = ANY($1::int[])',
                [pedidoIds]
            );
            itemsPorPedido = itemsResult.rows.reduce((acc, item) => {
                (acc[item.pedido_id] ||= []).push(item);
                return acc;
            }, {});

            const historialResult = await pool.query(
                'SELECT * FROM pedidos_historial WHERE pedido_id = ANY($1::int[]) ORDER BY created_at ASC',
                [pedidoIds]
            );
            historialPorPedido = historialResult.rows.reduce((acc, h) => {
                (acc[h.pedido_id] ||= []).push(h);
                return acc;
            }, {});
        }

        const pedidosConDetalle = pedidos.map((p) => ({
            ...p,
            items: itemsPorPedido[p.id] || [],
            historial: historialPorPedido[p.id] || []
        }));

        res.render('admin/pedidos', {
            titulo: 'Gestión de Pedidos',
            pedidos: pedidosConDetalle,
            total,
            totalPaginas,
            paginaActual,
            filtros: {
                estado: estado || '',
                estadoPago: estadoPago || '',
                busqueda: busqueda || '',
                desde: desde || '',
                hasta: hasta || ''
            }
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/pedidos - ERROR: ${error.message}`);
        next(error);
    }
};