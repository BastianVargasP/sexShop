import { getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const ENVIO_EXPRESS = 5990;

const generarNumeroPedido = () =>
    `PED-${Date.now().toString(36).toUpperCase()}`;

/* ==================== Mostrar checkout ==================== */

export const mostrarCheckout = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();

        const itemsResult = await conexion.query(
            `SELECT ci.id, ci.producto_id, ci.cantidad,
                    p.nombre, p.descripcion_corta, p.imagen, p.precio
             FROM carrito_items ci
             JOIN productos p ON p.id = ci.producto_id
             WHERE ci.cliente_id = $1
             ORDER BY ci.created_at DESC`,
            [req.session.usuario.id]
        );

        if (itemsResult.rows.length === 0) {
            return res.redirect('/carrito');
        }

        const direccionesResult = await conexion.query(
            'SELECT * FROM direcciones WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        const metodosPagoResult = await conexion.query(
            'SELECT * FROM metodos_pago WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        const items = itemsResult.rows;
        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        const envio = ENVIO_EXPRESS;
        const total = subtotal + envio;

        res.render('checkout', {
            title: 'Checkout',
            items,
            subtotal,
            envio,
            total,
            direcciones: direccionesResult.rows,
            metodosPago: metodosPagoResult.rows
        });
    } catch (error) {
        registrarActividad(`❌ GET /checkout - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};

/* ==================== Procesar checkout (crear pedido) ==================== */

export const procesarCheckout = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        const { direccionId, metodoPagoId } = req.body;

        if (!direccionId || !metodoPagoId) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Debes seleccionar una dirección de envío y un método de pago.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        await conexion.connect();
        await conexion.query('BEGIN');

        // Verificar que la dirección y el metodo de pago pertenecen al cliente
        const direccionResult = await conexion.query(
            'SELECT id FROM direcciones WHERE id = $1 AND cliente_id = $2',
            [direccionId, req.session.usuario.id]
        );
        const metodoResult = await conexion.query(
            'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [metodoPagoId, req.session.usuario.id]
        );

        if (direccionResult.rows.length === 0 || metodoResult.rows.length === 0) {
            await conexion.query('ROLLBACK');
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'La dirección o el método de pago seleccionados no son válidos.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        // Traer el carrito actual (fuente de verdad de qué se compra)
        const itemsResult = await conexion.query(
            `SELECT ci.producto_id, ci.cantidad, p.nombre, p.descripcion_corta, p.imagen, p.precio
             FROM carrito_items ci
             JOIN productos p ON p.id = ci.producto_id
             WHERE ci.cliente_id = $1`,
            [req.session.usuario.id]
        );

        if (itemsResult.rows.length === 0) {
            await conexion.query('ROLLBACK');
            return res.redirect('/carrito');
        }

        const items = itemsResult.rows;
        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        const envio = ENVIO_EXPRESS;
        const total = subtotal + envio;
        const numeroPedido = generarNumeroPedido();

        const pedidoResult = await conexion.query(
            `INSERT INTO pedidos (cliente_id, numero_pedido, estado, subtotal, envio, total, direccion_id, metodo_pago_id)
             VALUES ($1, $2, 'procesando', $3, $4, $5, $6, $7)
             RETURNING id`,
            [req.session.usuario.id, numeroPedido, subtotal, envio, total, direccionId, metodoPagoId]
        );
        const pedidoId = pedidoResult.rows[0].id;

        for (const item of items) {
            await conexion.query(
                `INSERT INTO pedido_items (pedido_id, producto_id, producto_nombre, producto_descripcion, producto_imagen, precio_unitario, cantidad)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [pedidoId, item.producto_id, item.nombre, item.descripcion_corta, item.imagen, item.precio, item.cantidad]
            );
        }

        await conexion.query('DELETE FROM carrito_items WHERE cliente_id = $1', [req.session.usuario.id]);

        await conexion.query('COMMIT');

        registrarActividad(`💳 POST /checkout - ÉXITO: pedido ${numeroPedido} creado (cliente #${req.session.usuario.id}).`);
        res.redirect(`/pedidos/${pedidoId}`);
    } catch (error) {
        try {
            await conexion.query('ROLLBACK');
        } catch (_) { /* la conexión puede ya estar cerrada, se ignora */ }
        registrarActividad(`💳❌ POST /checkout - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};