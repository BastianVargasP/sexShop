import { pool, getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { validarCupon } from '../helpers/cupones.js';
import { quiereJson } from '../helpers/peticiones.js';

const ENVIO_EXPRESS = 5990;

const generarNumeroPedido = () =>
    `PED-${Date.now().toString(36).toUpperCase()}`;

const calcularTotales = async (clienteId, cuponCodigo) => {
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
    let envio = ENVIO_EXPRESS;
    let descuento = 0;
    let cuponAplicado = null;
    let errorCupon = null;

    if (cuponCodigo) {
        const validacion = await validarCupon({ codigo: cuponCodigo, clienteId, subtotal, envio });
        if (validacion.ok) {
            descuento = validacion.descuento;
            if (validacion.envioGratis) envio = 0;
            cuponAplicado = validacion.cupon;
        } else {
            errorCupon = validacion.error;
        }
    }

    const total = Math.max(0, subtotal + envio - descuento);
    return { items, subtotal, envio, descuento, total, cuponAplicado, errorCupon };
};

/* ==================== Mostrar checkout ==================== */

export const mostrarCheckout = async (req, res, next) => {
    try {
        const { items, subtotal, envio, descuento, total, cuponAplicado, errorCupon } =
            await calcularTotales(req.session.usuario.id, req.session.cuponCodigo);

        if (items.length === 0) {
            return res.redirect('/carrito');
        }

        // Si el cupón guardado en sesión ya no es válido (expiró, se agotó, etc.), lo limpiamos
        if (req.session.cuponCodigo && errorCupon) {
            delete req.session.cuponCodigo;
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
            cupon: cuponAplicado,
            errorCupon: errorCupon && req.session.cuponCodigo ? null : errorCupon,
            direcciones: direccionesResult.rows,
            metodosPago: metodosPagoResult.rows
        });
    } catch (error) {
        registrarActividad(`❌ GET /checkout - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Aplicar / quitar cupón (AJAX) ==================== */

export const aplicarCupon = async (req, res) => {
    try {
        const { codigo } = req.body;
        const { subtotal, envio, descuento, total, cuponAplicado, errorCupon } =
            await calcularTotales(req.session.usuario.id, codigo);

        if (errorCupon) {
            return res.status(400).json({ ok: false, error: errorCupon });
        }

        req.session.cuponCodigo = codigo.trim().toUpperCase();
        registrarActividad(`🏷️ POST /checkout/cupon - ÉXITO: cliente #${req.session.usuario.id} aplicó "${req.session.cuponCodigo}".`);

        res.json({
            ok: true,
            subtotal,
            envio,
            descuento,
            total,
            cupon: { codigo: cuponAplicado.codigo, descripcion: cuponAplicado.descripcion }
        });
    } catch (error) {
        registrarActividad(`🏷️❌ POST /checkout/cupon - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo aplicar el cupón.' });
    }
};

export const quitarCupon = async (req, res) => {
    try {
        delete req.session.cuponCodigo;
        const { subtotal, envio, total } = await calcularTotales(req.session.usuario.id, null);
        res.json({ ok: true, subtotal, envio, descuento: 0, total });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'No se pudo quitar el cupón.' });
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
        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        let envio = ENVIO_EXPRESS;
        let descuento = 0;
        let cuponAplicado = null;

        // Se revalida el cupón dentro de la transacción, por si cambió de estado entre que se mostró el checkout y se confirmó el pago
        if (req.session.cuponCodigo) {
            const validacion = await validarCupon({
                codigo: req.session.cuponCodigo,
                clienteId: req.session.usuario.id,
                subtotal,
                envio
            });
            if (validacion.ok) {
                descuento = validacion.descuento;
                if (validacion.envioGratis) envio = 0;
                cuponAplicado = validacion.cupon;
            }
            // si ya no es válido, simplemente se procesa el pedido sin descuento
        }

        const total = Math.max(0, subtotal + envio - descuento);
        const numeroPedido = generarNumeroPedido();

        const pedidoResult = await conexion.query(
            `INSERT INTO pedidos (cliente_id, numero_pedido, estado, estado_pago, subtotal, envio, total, direccion_id, metodo_pago_id, cupon_id, cupon_codigo, descuento)
             VALUES ($1, $2, 'procesando', 'pagado', $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id`,
            [
                req.session.usuario.id, numeroPedido, subtotal, envio, total, direccionId, metodoPagoId,
                cuponAplicado ? cuponAplicado.id : null,
                cuponAplicado ? cuponAplicado.codigo : null,
                descuento
            ]
        );
        const pedidoId = pedidoResult.rows[0].id;

        for (const item of items) {
            await conexion.query(
                `INSERT INTO pedido_items (pedido_id, producto_id, producto_nombre, producto_descripcion, producto_imagen, precio_unitario, cantidad)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [pedidoId, item.producto_id, item.nombre, item.descripcion_corta, item.imagen, item.precio, item.cantidad]
            );
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