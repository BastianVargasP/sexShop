import { pool, getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { quiereJson } from '../helpers/peticiones.js';

const ENVIO_EXPRESS = 5990;

const generarNumeroPedido = () =>
    `PED-${Date.now().toString(36).toUpperCase()}`;

const calcularTotales = async (clienteId) => {
    const itemsResult = await pool.query(
        `SELECT ci.id, ci.producto_id, ci.cantidad,
                p.nombre, p.descripcion_corta, p.imagen, p.precio
         FROM carrito_items ci
                  JOIN productos p ON p.id = ci.producto_id
         WHERE ci.cliente_id = $1
         ORDER BY ci.created_at DESC`,
        [clienteId]
    );

    const items = itemsResult.rows;
    const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
    const envio = ENVIO_EXPRESS;
    const total = subtotal + envio;

    return { items, subtotal, envio, total };
};

/* ==================== Mostrar checkout ==================== */

export const mostrarCheckout = async (req, res, next) => {
    try {
        const { items, subtotal, envio, descuento, total } =
            await calcularTotales(req.session.usuario.id);

        if (items.length === 0) {
            return res.redirect('/carrito');
        }

        const direccionesResult = await pool.query(
            'SELECT * FROM direcciones WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        const metodosPagoResult = await pool.query(
            'SELECT * FROM metodos_pago WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        res.render('checkout', {
            title: 'Checkout',
            items,
            subtotal,
            envio,
            descuento,
            total,
            direcciones: direccionesResult.rows,
            metodosPago: metodosPagoResult.rows
        });
    } catch (error) {
        registrarActividad(`❌ GET /checkout - ERROR: ${error.message}`);
        next(error);
    }
};


/* ==================== Procesar checkout (crear pedido) ==================== */

export const procesarCheckout = async (req, res, next) => {
    const { direccionId, metodoPagoId } = req.body;

    if (!direccionId || !metodoPagoId) {
        return res.status(400).render('error', {
            ok: false,
            mensaje: 'Debes seleccionar una dirección de envío y un método de pago.',
            error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
        });
    }

    const conexion = await getDbClient();
    try {
        await conexion.query('BEGIN');

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

        // Bloqueamos las filas de stock de los productos involucrados (en orden estable por id,
        // para evitar deadlocks si dos checkouts distintos comparten productos) y validamos
        // que haya stock físico suficiente antes de cobrar nada.
        const productoIds = [...items.map((i) => i.producto_id)].sort((a, b) => a - b);
        const stockResult = await conexion.query(
            'SELECT id, nombre, stock FROM productos WHERE id = ANY($1::int[]) FOR UPDATE',
            [productoIds]
        );
        const stockPorProducto = new Map(stockResult.rows.map((p) => [p.id, p]));

        const faltantes = items.filter((item) => {
            const producto = stockPorProducto.get(item.producto_id);
            return !producto || producto.stock < item.cantidad;
        });

        if (faltantes.length > 0) {
            await conexion.query('ROLLBACK');
            const nombres = faltantes.map((f) => stockPorProducto.get(f.producto_id)?.nombre || f.nombre).join(', ');
            return res.status(409).render('error', {
                ok: false,
                mensaje: `No hay stock suficiente para: ${nombres}. Ajusta las cantidades en tu carrito e intenta nuevamente.`,
                error: { status: 409, stack: 'El stock disponible cambió entre que agregaste el producto y confirmaste la compra.' }
            });
        }

        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        let envio = ENVIO_EXPRESS;

        const total = Math.max(0, subtotal + envio - descuento);
        const numeroPedido = generarNumeroPedido();

        const pedidoResult = await conexion.query(
            `INSERT INTO pedidos (cliente_id, numero_pedido, estado, estado_pago, subtotal, envio, total, direccion_id, metodo_pago_id)
             VALUES ($1, $2, 'procesando', 'pagado', $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id`,
            [
                req.session.usuario.id, numeroPedido, subtotal, envio, total, direccionId, metodoPagoId,
            ]
        );
        const pedidoId = pedidoResult.rows[0].id;

        for (const item of items) {
            await conexion.query(
                `INSERT INTO pedido_items (pedido_id, producto_id, producto_nombre, producto_descripcion, producto_imagen, precio_unitario, cantidad)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [pedidoId, item.producto_id, item.nombre, item.descripcion_corta, item.imagen, item.precio, item.cantidad]
            );

            // Descuento automático de stock físico, con su rastro en el historial de inventario
            const stockAnterior = stockPorProducto.get(item.producto_id).stock;
            const stockNuevo = stockAnterior - item.cantidad;

            await conexion.query('UPDATE productos SET stock = $1 WHERE id = $2', [stockNuevo, item.producto_id]);

            await conexion.query(
                `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, actor)
                 VALUES ($1, 'venta', $2, $3, $4, $5, $6)`,
                [
                    item.producto_id,
                    item.cantidad,
                    stockAnterior,
                    stockNuevo,
                    `Venta automática - Pedido ${numeroPedido}`,
                    `${req.session.usuario.nombre} ${req.session.usuario.apellido} (cliente)`
                ]
            );

            // Actualizamos el mapa en memoria por si el mismo producto aparece más de una vez (no debería, pero por seguridad)
            stockPorProducto.set(item.producto_id, { ...stockPorProducto.get(item.producto_id), stock: stockNuevo });
        }

        await conexion.query(
            `INSERT INTO pedidos_historial (pedido_id, estado, estado_pago, actor)
             VALUES ($1, 'procesando', 'pagado', $2)`,
            [pedidoId, `${req.session.usuario.nombre} ${req.session.usuario.apellido} (cliente)`]
        );

        if (cuponAplicado) {
            await conexion.query(
                `INSERT INTO cupones_usos (cupon_id, cliente_id, pedido_id) VALUES ($1, $2, $3)`,
                [cuponAplicado.id, req.session.usuario.id, pedidoId]
            );
        }

        await conexion.query('DELETE FROM carrito_items WHERE cliente_id = $1', [req.session.usuario.id]);

        await conexion.query('COMMIT');

        delete req.session.cuponCodigo;

        registrarActividad(`💳 POST /checkout - ÉXITO: pedido ${numeroPedido} creado (cliente #${req.session.usuario.id})${cuponAplicado ? ` con cupón ${cuponAplicado.codigo}` : ''}.`);
        res.redirect(`/pedidos/${pedidoId}`);
    } catch (error) {
        try {
            await conexion.query('ROLLBACK');
        } catch (_) { /* la conexión puede ya estar en mal estado, se ignora */ }
        registrarActividad(`💳❌ POST /checkout - ERROR: ${error.message}`);
        next(error);
    } finally {
        conexion.release();
    }
};