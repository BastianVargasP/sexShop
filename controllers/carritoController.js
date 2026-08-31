import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { quiereJson } from '../helpers/peticiones.js';

/* ==================== Agregar producto al carrito ==================== */

export const agregarAlCarrito = async (req, res, next) => {
    try {
        const productoResult = await pool.query('SELECT id FROM productos WHERE id = $1', [req.params.id]);
        if (productoResult.rows.length === 0) {
            return next(); // producto inexistente -> 404
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

        res.render('carrito', { title: 'Carrito', items, subtotal });
    } catch (error) {
        registrarActividad(`❌ GET /carrito - ERROR: ${error.message}`);
        next(error);
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