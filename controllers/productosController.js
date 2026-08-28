import { getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { quiereJson } from '../helpers/peticiones.js';

const obtenerFavoritosIds = async (conexion, clienteId) => {
    if (!clienteId) return new Set();
    const favResult = await conexion.query(
        'SELECT producto_id FROM favoritos WHERE cliente_id = $1',
        [clienteId]
    );
    return new Set(favResult.rows.map((r) => r.producto_id));
};

export const listarProductos = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query(
            'SELECT * FROM productos ORDER BY destacado DESC, created_at DESC'
        );
        const favoritosIds = await obtenerFavoritosIds(conexion, req.session.usuario?.id);

        res.render('productos', { title: 'Productos', productos: resultado.rows, favoritosIds });
    } catch (error) {
        registrarActividad(`❌ GET /productos - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};

export const verProducto = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        const producto = resultado.rows[0];
        const relacionadosResult = await conexion.query(
            `SELECT * FROM productos WHERE categoria = $1 AND id != $2
             ORDER BY destacado DESC, created_at DESC LIMIT 3`,
            [producto.categoria, producto.id]
        );

        const favoritosIds = await obtenerFavoritosIds(conexion, req.session.usuario?.id);

        res.render('producto', {
            title: producto.nombre,
            producto,
            esFavorito: favoritosIds.has(producto.id),
            relacionados: relacionadosResult.rows,
            favoritosIds
        });
    } catch (error) {
        registrarActividad(`❌ GET /productos/${req.params.id} - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};

export const agregarFavorito = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        await conexion.query(
            `INSERT INTO favoritos (cliente_id, producto_id) VALUES ($1, $2)
                ON CONFLICT (cliente_id, producto_id) DO NOTHING`,
            [req.session.usuario.id, req.params.id]
        );
        registrarActividad(`❤️ POST /productos/${req.params.id}/favorito - ÉXITO: cliente #${req.session.usuario.id}.`);

        if (quiereJson(req)) return res.json({ ok: true, favorito: true });
        res.redirect(req.get('Referrer') || '/productos');
    } catch (error) {
        registrarActividad(`❤️❌ POST /productos/${req.params.id}/favorito - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false, error: 'No se pudo guardar el favorito.' });
        next(error);
    } finally {
        await conexion.end();
    }
};

export const quitarFavorito = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        await conexion.query(
            'DELETE FROM favoritos WHERE cliente_id = $1 AND producto_id = $2',
            [req.session.usuario.id, req.params.id]
        );
        registrarActividad(`❤️ POST /productos/${req.params.id}/quitar-favorito - ÉXITO: cliente #${req.session.usuario.id}.`);

        if (quiereJson(req)) return res.json({ ok: true, favorito: false });
        res.redirect(req.get('Referrer') || '/productos');
    } catch (error) {
        registrarActividad(`❤️❌ POST /productos/${req.params.id}/quitar-favorito - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false, error: 'No se pudo quitar el favorito.' });
        next(error);
    } finally {
        await conexion.end();
    }
};