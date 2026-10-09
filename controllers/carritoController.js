import { pool, getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { quiereJson } from '../helpers/peticiones.js';
import { enlaceWhatsAppCarrito } from '../helpers/whatsapp.js';

/* ==================== Agregar producto al carrito ==================== */

export const agregarAlCarrito = async (req, res, next) => {
    try {
        const productoResult = await pool.query('SELECT id, stock FROM productos WHERE id = $1', [req.params.id]);
        if (productoResult.rows.length === 0) {
            return next(); // producto inexistente -> 404
        }

        if (productoResult.rows[0].stock <= 0) {
            const mensaje = 'Este producto está agotado.';
            if (quiereJson(req)) return res.status(409).json({ ok: false, error: mensaje });
            return res.status(409).render('error', {
                ok: false, mensaje,
                error: { status: 409, stack: 'Vuelve al catálogo para ver los productos disponibles.' }
            });
        }

        await pool.query(
            `INSERT INTO carrito_items (cliente_id, producto_id, cantidad)
             VALUES ($1, $2, 1)
                 ON CONFLICT (cliente_id, producto_id)
             DO UPDATE SET cantidad = carrito_items.cantidad + 1`,
            [req.session.usuario.id, req.params.id]
        );

        const totalResult = await pool.query(
            'SELECT COALESCE(SUM(cantidad), 0) AS total FROM carrito_items WHERE cliente_id = $1',
            [req.session.usuario.id]
        );

        registrarActividad(`🛒 POST /productos/${req.params.id}/carrito - ÉXITO: cliente #${req.session.usuario.id}.`);

        if (quiereJson(req)) {
            return res.json({ ok: true, cantidadCarrito: Number(totalResult.rows[0].total) });
        }
        res.redirect('/carrito');
    } catch (error) {
        registrarActividad(`🛒❌ POST /productos/${req.params.id}/carrito - ERROR: ${error.message}`);
        if (quiereJson(req)) {
            return res.status(500).json({ ok: false, error: 'No se pudo añadir el producto al carrito.' });
        }
        next(error);
    }
};

/* ==================== Ver carrito ==================== */

export const verCarrito = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT ci.id, ci.producto_id, ci.cantidad,
                    p.nombre, p.descripcion_corta, p.imagen, p.precio
             FROM carrito_items ci
                      JOIN productos p ON p.id = ci.producto_id
             WHERE ci.cliente_id = $1
             ORDER BY ci.created_at DESC`,
            [req.session.usuario.id]
        );

        const items = resultado.rows;
        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        const totalArticulos = items.reduce((acc, item) => acc + item.cantidad, 0);

        res.render('carrito', { title: 'Carrito', items, subtotal, totalArticulos });
    } catch (error) {
        registrarActividad(`❌ GET /carrito - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Enviar el carrito por WhatsApp (crea el pedido pendiente) ==================== */

const generarNumeroPedido = () => `PED-${Date.now().toString(36).toUpperCase()}`;

// Todo ocurre en una transacción: se valida stock, se crea el pedido (Procesando / pago Pendiente),
// se descuenta el stock, se vacía el carrito y recién ahí se redirige a WhatsApp con el número de pedido.
// Si el admin cancela o marca como devuelto el pedido, el stock se repone solo (ya lo hace adminPedidosController).
export const enviarPorWhatsApp = async (req, res, next) => {
    const clienteId = req.session.usuario.id;
    const nombreCliente = `${req.session.usuario.nombre} ${req.session.usuario.apellido}`;
    const actor = `${nombreCliente} (cliente, WhatsApp)`;

    const conexion = await getDbClient();
    try {
        await conexion.query('BEGIN');

        const itemsResult = await conexion.query(
            `SELECT ci.producto_id, ci.cantidad, p.nombre, p.descripcion_corta, p.imagen, p.precio
             FROM carrito_items ci
                      JOIN productos p ON p.id = ci.producto_id
             WHERE ci.cliente_id = $1
             ORDER BY ci.created_at ASC`,
            [clienteId]
        );
        const items = itemsResult.rows;

        if (items.length === 0) {
            await conexion.query('ROLLBACK');
            if (quiereJson(req)) return res.status(400).json({ ok: false, error: 'Tu carrito está vacío.' });
            return res.redirect('/carrito');
        }

        // Bloqueo de filas de stock en orden estable (evita deadlocks entre pedidos simultáneos)
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

            // Con fetch (carrito.js) se responde con el detalle para mostrar el modal
            if (quiereJson(req)) {
                const problemas = faltantes.map((item) => {
                    const disponible = Math.max(Number(stockPorProducto.get(item.producto_id)?.stock) || 0, 0);
                    return {
                        producto_id: item.producto_id,
                        nombre: item.nombre,
                        solicitado: item.cantidad,
                        disponible,
                        agotado: disponible === 0
                    };
                });
                return res.status(409).json({ ok: false, codigo: 'STOCK_INSUFICIENTE', problemas });
            }

            const nombres = faltantes.map((f) => stockPorProducto.get(f.producto_id)?.nombre || f.nombre).join(', ');
            return res.status(409).render('error', {
                ok: false,
                mensaje: `No hay stock suficiente para: ${nombres}. Ajusta las cantidades en tu carrito e intenta nuevamente.`,
                error: { status: 409, stack: 'El stock disponible cambió desde que agregaste el producto.' }
            });
        }

        const subtotal = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
        const envio = 0; // se coordina por WhatsApp
        const total = subtotal + envio;
        const numeroPedido = generarNumeroPedido();

        const pedidoResult = await conexion.query(
            `INSERT INTO pedidos (cliente_id, numero_pedido, estado, estado_pago, subtotal, envio, total)
             VALUES ($1, $2, 'procesando', 'pendiente', $3, $4, $5)
                 RETURNING id`,
            [clienteId, numeroPedido, subtotal, envio, total]
        );
        const pedidoId = pedidoResult.rows[0].id;

        for (const item of items) {
            await conexion.query(
                `INSERT INTO pedido_items (pedido_id, producto_id, producto_nombre, producto_descripcion, producto_imagen, precio_unitario, cantidad)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [pedidoId, item.producto_id, item.nombre, item.descripcion_corta, item.imagen, item.precio, item.cantidad]
            );

            const stockAnterior = stockPorProducto.get(item.producto_id).stock;
            const stockNuevo = stockAnterior - item.cantidad;

            await conexion.query('UPDATE productos SET stock = $1 WHERE id = $2', [stockNuevo, item.producto_id]);

            await conexion.query(
                `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, actor)
                 VALUES ($1, 'venta', $2, $3, $4, $5, $6)`,
                [item.producto_id, item.cantidad, stockAnterior, stockNuevo, `Pedido por WhatsApp ${numeroPedido} (pendiente de confirmación)`, actor]
            );

            stockPorProducto.set(item.producto_id, { ...stockPorProducto.get(item.producto_id), stock: stockNuevo });
        }

        await conexion.query(
            `INSERT INTO pedidos_historial (pedido_id, estado, estado_pago, actor)
             VALUES ($1, 'procesando', 'pendiente', $2)`,
            [pedidoId, actor]
        );

        await conexion.query('DELETE FROM carrito_items WHERE cliente_id = $1', [clienteId]);

        await conexion.query('COMMIT');

        registrarActividad(`🛒 POST /carrito/whatsapp - ÉXITO: pedido ${numeroPedido} creado (cliente #${clienteId}, ${items.length} producto(s)).`);
        const urlWhatsApp = enlaceWhatsAppCarrito(items, nombreCliente, numeroPedido);
        if (quiereJson(req)) return res.json({ ok: true, url: urlWhatsApp, numeroPedido });
        res.redirect(urlWhatsApp);
    } catch (error) {
        try { await conexion.query('ROLLBACK'); } catch (_) { /* la conexión puede estar en mal estado */ }
        registrarActividad(`🛒❌ POST /carrito/whatsapp - ERROR: ${error.message}`);
        if (quiereJson(req)) {
            return res.status(500).json({ ok: false, error: 'No se pudo crear el pedido. Intenta de nuevo.' });
        }
        next(error);
    } finally {
        conexion.release();
    }
};

/* ==================== Resolver problemas de stock del carrito ==================== */

// Quita del carrito los productos agotados (stock <= 0).
export const quitarAgotados = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `DELETE FROM carrito_items ci
             USING productos p
             WHERE ci.producto_id = p.id AND ci.cliente_id = $1 AND p.stock <= 0`,
            [req.session.usuario.id]
        );
        registrarActividad(`🛒 POST /carrito/quitar-agotados - ÉXITO: ${resultado.rowCount} ítem(s) quitado(s).`);
        if (quiereJson(req)) return res.json({ ok: true, quitados: resultado.rowCount });
        res.redirect('/carrito');
    } catch (error) {
        registrarActividad(`🛒❌ POST /carrito/quitar-agotados - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false });
        next(error);
    }
};

// Quita los agotados y baja la cantidad de los ítems que superan el stock disponible.
export const ajustarCantidades = async (req, res, next) => {
    const conexion = await getDbClient();
    try {
        await conexion.query('BEGIN');

        const quitados = await conexion.query(
            `DELETE FROM carrito_items ci
             USING productos p
             WHERE ci.producto_id = p.id AND ci.cliente_id = $1 AND p.stock <= 0`,
            [req.session.usuario.id]
        );
        const ajustados = await conexion.query(
            `UPDATE carrito_items ci
             SET cantidad = p.stock
             FROM productos p
             WHERE ci.producto_id = p.id AND ci.cliente_id = $1 AND ci.cantidad > p.stock`,
            [req.session.usuario.id]
        );

        await conexion.query('COMMIT');

        registrarActividad(`🛒 POST /carrito/ajustar-cantidades - ÉXITO: ${quitados.rowCount} quitado(s), ${ajustados.rowCount} ajustado(s).`);
        if (quiereJson(req)) return res.json({ ok: true, quitados: quitados.rowCount, ajustados: ajustados.rowCount });
        res.redirect('/carrito');
    } catch (error) {
        try { await conexion.query('ROLLBACK'); } catch (_) { /* conexión en mal estado */ }
        registrarActividad(`🛒❌ POST /carrito/ajustar-cantidades - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false });
        next(error);
    } finally {
        conexion.release();
    }
};

/* ==================== Incrementar / decrementar / eliminar ítem ==================== */

export const incrementar = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `UPDATE carrito_items SET cantidad = cantidad + 1
             WHERE id = $1 AND cliente_id = $2
                 RETURNING cantidad`,
            [req.params.id, req.session.usuario.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🛒 POST /carrito/${req.params.id}/incrementar - ÉXITO.`);
        if (quiereJson(req)) {
            return res.json({ ok: true, cantidad: resultado.rows[0].cantidad });
        }
        res.redirect('/carrito');
    } catch (error) {
        registrarActividad(`🛒❌ POST /carrito/${req.params.id}/incrementar - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false });
        next(error);
    }
};

export const decrementar = async (req, res, next) => {
    try {
        const actual = await pool.query(
            'SELECT cantidad FROM carrito_items WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (actual.rows.length === 0) return next();

        if (actual.rows[0].cantidad <= 1) {
            await pool.query(
                'DELETE FROM carrito_items WHERE id = $1 AND cliente_id = $2',
                [req.params.id, req.session.usuario.id]
            );
            registrarActividad(`🛒 POST /carrito/${req.params.id}/decrementar - ÉXITO: eliminado (cantidad llegó a 0).`);
            if (quiereJson(req)) return res.json({ ok: true, cantidad: 0, eliminado: true });
            return res.redirect('/carrito');
        }

        const resultado = await pool.query(
            `UPDATE carrito_items SET cantidad = cantidad - 1
             WHERE id = $1 AND cliente_id = $2
                 RETURNING cantidad`,
            [req.params.id, req.session.usuario.id]
        );

        registrarActividad(`🛒 POST /carrito/${req.params.id}/decrementar - ÉXITO.`);
        if (quiereJson(req)) return res.json({ ok: true, cantidad: resultado.rows[0].cantidad, eliminado: false });
        res.redirect('/carrito');
    } catch (error) {
        registrarActividad(`🛒❌ POST /carrito/${req.params.id}/decrementar - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false });
        next(error);
    }
};

export const eliminarItem = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'DELETE FROM carrito_items WHERE id = $1 AND cliente_id = $2 RETURNING id',
            [req.params.id, req.session.usuario.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🛒 POST /carrito/${req.params.id}/eliminar - ÉXITO.`);
        if (quiereJson(req)) return res.json({ ok: true });
        res.redirect('/carrito');
    } catch (error) {
        registrarActividad(`🛒❌ POST /carrito/${req.params.id}/eliminar - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false });
        next(error);
    }
};