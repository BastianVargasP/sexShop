import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { quiereJson } from '../helpers/peticiones.js';

const obtenerFavoritosIds = async (clienteId) => {
    if (!clienteId) return new Set();
    const favResult = await pool.query(
        'SELECT producto_id FROM favoritos WHERE cliente_id = $1',
        [clienteId]
    );
    return new Set(favResult.rows.map((r) => r.producto_id));
};

export const listarProductos = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre, s.nombre AS subcategoria_nombre
             FROM productos p
                      LEFT JOIN categorias c ON c.id = p.categoria_id
                      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
             WHERE p.activo = TRUE
             ORDER BY p.destacado DESC, p.created_at DESC`
        );

        // Solo categorías activas y con al menos un producto activo
        const categoriasResult = await pool.query(
            `SELECT c.id, c.nombre
             FROM categorias c
             WHERE c.activa = TRUE
               AND EXISTS (
                 SELECT 1 FROM productos p WHERE p.categoria_id = c.id AND p.activo = TRUE
             )
             ORDER BY c.orden ASC, c.nombre ASC`
        );

        // Solo subcategorías activas, con producto activo, y cuya categoría padre también esté activa
        const subcategoriasResult = await pool.query(
            `SELECT s.id, s.nombre, s.categoria_id
             FROM subcategorias s
             JOIN categorias c ON c.id = s.categoria_id
             WHERE s.activa = TRUE
               AND c.activa = TRUE
               AND EXISTS (
                   SELECT 1 FROM productos p WHERE p.subcategoria_id = s.id AND p.activo = TRUE
               )
             ORDER BY s.orden ASC, s.nombre ASC`
        );

        const favoritosIds = await obtenerFavoritosIds(req.session.usuario?.id);

        res.render('productos', {
            title: 'Productos',
            productos: resultado.rows,
            categoriasFiltro: categoriasResult.rows,
            subcategoriasFiltro: subcategoriasResult.rows,
            favoritosIds
        });
    } catch (error) {
        registrarActividad(`❌ GET /productos - ERROR: ${error.message}`);
        next(error);
    }
};

export const verProducto = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre, s.nombre AS subcategoria_nombre
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
             WHERE p.id = $1 AND p.activo = TRUE`,
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        const producto = resultado.rows[0];

        // Relacionados: prioriza misma subcategoría; si no hay suficientes, completa con la misma categoría
        const relacionadosResult = await pool.query(
            `SELECT * FROM productos
             WHERE activo = TRUE AND id != $1 AND categoria_id = $2
             ORDER BY (subcategoria_id = $3) DESC, destacado DESC, created_at DESC
                 LIMIT 3`,
            [producto.id, producto.categoria_id, producto.subcategoria_id]
        );

        const favoritosIds = await obtenerFavoritosIds(req.session.usuario?.id);

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
    }
};

export const agregarFavorito = async (req, res, next) => {
    try {
        await pool.query(
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
    }
};

export const quitarFavorito = async (req, res, next) => {
    try {
        await pool.query(
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
    }
};