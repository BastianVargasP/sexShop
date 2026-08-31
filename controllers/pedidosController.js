import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const PASOS_POR_ESTADO = { procesando: 2, enviado: 3, entregado: 4, devuelto: 4 };

export const listarPedidos = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT id, numero_pedido, estado, total, created_at
             FROM pedidos WHERE cliente_id = $1 ORDER BY created_at DESC`,
            [req.session.usuario.id]
        );

        res.render('pedidos', { title: 'Mis pedidos', pedidos: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /pedidos - ERROR: ${error.message}`);
        next(error);
    }
};

export const verPedido = async (req, res, next) => {
    try {
        const pedidoResult = await pool.query(
            `SELECT p.*, d.direccion, d.ciudad, d.codigo_postal, d.comuna, d.region,
                    m.marca, m.ultimos_digitos
             FROM pedidos p
                      LEFT JOIN direcciones d ON d.id = p.direccion_id
                      LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
             WHERE p.id = $1 AND p.cliente_id = $2`,
            [req.params.id, req.session.usuario.id]
        );

        if (pedidoResult.rows.length === 0) {
            return next();
        }

        const itemsResult = await pool.query(
            'SELECT * FROM pedido_items WHERE pedido_id = $1',
            [req.params.id]
        );

        res.render('pedido', {
            title: 'Detalle del pedido',
            pedido: pedidoResult.rows[0],
            items: itemsResult.rows,
            pasoActual: PASOS_POR_ESTADO[pedidoResult.rows[0].estado] || 1
        });
    } catch (error) {
        registrarActividad(`❌ GET /pedido/${req.params.id} - ERROR: ${error.message}`);
        next(error);
    }
};