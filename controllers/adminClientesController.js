import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const PAGE_SIZE = 20;

/* ==================== Listado con filtros y paginación ==================== */

export const listarClientes = async (req, res, next) => {
    try {
        const { busqueda, estado, fecha, pedidos, pagina } = req.query;
        const condiciones = [];
        const valores = [];

        if (busqueda) {
            valores.push(`%${busqueda}%`);
            condiciones.push(`(cl.nombre ILIKE $${valores.length} OR cl.apellido ILIKE $${valores.length} OR cl.email ILIKE $${valores.length})`);
        }
        if (estado === 'bloqueado') {
            condiciones.push('cl.bloqueado = TRUE');
        } else if (estado === 'activo') {
            condiciones.push('cl.bloqueado = FALSE AND EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = cl.id)');
        } else if (estado === 'inactivo') {
            condiciones.push('cl.bloqueado = FALSE AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = cl.id)');
        }
        if (fecha === '30dias') {
            condiciones.push(`cl.created_at >= NOW() - INTERVAL '30 days'`);
        } else if (fecha === 'anio') {
            condiciones.push(`cl.created_at >= date_trunc('year', NOW())`);
        }
        if (pedidos === 'con-pedidos') {
            condiciones.push('EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = cl.id)');
        } else if (pedidos === 'sin-pedidos') {
            condiciones.push('NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = cl.id)');
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const paginaActual = Math.max(1, parseInt(pagina, 10) || 1);
        const offset = (paginaActual - 1) * PAGE_SIZE;

        const totalResult = await pool.query(`SELECT COUNT(*) AS total FROM clientes cl ${where}`, valores);
        const total = Number(totalResult.rows[0].total);
        const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

        const clientesResult = await pool.query(
            `SELECT cl.id, cl.nombre, cl.apellido, cl.email, cl.telefono, cl.bloqueado, cl.created_at,
                    COALESCE(pc.total_pedidos, 0) AS total_pedidos,
                    COALESCE(pc.total_gastado, 0) AS total_gastado
             FROM clientes cl
             LEFT JOIN (
                 SELECT cliente_id, COUNT(*) AS total_pedidos, SUM(total) FILTER (WHERE estado != 'cancelado') AS total_gastado
                 FROM pedidos GROUP BY cliente_id
             ) pc ON pc.cliente_id = cl.id
             ${where}
             ORDER BY cl.created_at DESC
             LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
            valores
        );

        const clientes = clientesResult.rows.map((c) => ({
            ...c,
            estadoCalculado: c.bloqueado ? 'bloqueado' : (Number(c.total_pedidos) > 0 ? 'activo' : 'inactivo')
        }));

        res.render('admin/clientes', {
            titulo: 'Clientes',
            clientes,
            total,
            totalPaginas,
            paginaActual,
            filtros: {
                busqueda: busqueda || '',
                estado: estado || '',
                fecha: fecha || '',
                pedidos: pedidos || ''
            }
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/clientes - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Detalle de un cliente (para el drawer, vía AJAX) ==================== */

export const obtenerDetalleCliente = async (req, res) => {
    try {
        const clienteResult = await pool.query(
            'SELECT id, nombre, apellido, email, telefono, bloqueado, created_at FROM clientes WHERE id = $1',
            [req.params.id]
        );
        if (clienteResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Cliente no encontrado.' });
        }
        const cliente = clienteResult.rows[0];

        const direccionResult = await pool.query(
            'SELECT * FROM direcciones WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC LIMIT 1',
            [req.params.id]
        );

        const resumenResult = await pool.query(
            `SELECT
                 COUNT(*) AS total_pedidos,
                 COALESCE(SUM(total) FILTER (WHERE estado != 'cancelado'), 0) AS total_gastado,
                 COUNT(*) FILTER (WHERE estado = 'procesando') AS pendientes,
                 COUNT(*) FILTER (WHERE estado = 'cancelado') AS cancelados
             FROM pedidos WHERE cliente_id = $1`,
            [req.params.id]
        );

        const pedidosResult = await pool.query(
            `SELECT id, numero_pedido, estado, estado_pago, total, created_at
             FROM pedidos WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 5`,
            [req.params.id]
        );

        res.json({
            ok: true,
            cliente: {
                ...cliente,
                estadoCalculado: cliente.bloqueado ? 'bloqueado' : (Number(resumenResult.rows[0].total_pedidos) > 0 ? 'activo' : 'inactivo')
            },
            direccion: direccionResult.rows[0] || null,
            resumen: resumenResult.rows[0],
            pedidos: pedidosResult.rows,
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/clientes/${req.params.id}/detalle - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo cargar el detalle del cliente.' });
    }
};

/* ==================== Bloquear / Desbloquear ==================== */

export const alternarBloqueo = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'UPDATE clientes SET bloqueado = NOT bloqueado WHERE id = $1 RETURNING id, bloqueado, email',
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        const { bloqueado, email } = resultado.rows[0];
        registrarActividad(`👤 POST /admin/clientes/${req.params.id}/bloquear - ÉXITO: ${email} ahora ${bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO'}.`);

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ ok: true, bloqueado });
        }
        res.redirect('/admin/clientes');
    } catch (error) {
        registrarActividad(`👤❌ POST /admin/clientes/${req.params.id}/bloquear - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar ==================== */

export const eliminarCliente = async (req, res, next) => {
    try {
        const resultado = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        registrarActividad(`👤 POST /admin/clientes/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/admin/clientes');
    } catch (error) {
        if (error.code === '23503') {
            registrarActividad(`👤❌ POST /admin/clientes/${req.params.id}/eliminar - RECHAZADO: cliente referenciado.`);
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'No se puede eliminar: este cliente tiene pedidos, direcciones u otros datos asociados. Bloquéalo en su lugar.',
                error: { status: 409, stack: 'El historial de compras necesita conservar la referencia al cliente.' }
            });
        }
        registrarActividad(`👤❌ POST /admin/clientes/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};