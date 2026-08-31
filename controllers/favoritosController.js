import { pool } from "../helpers/database.js";
import { registrarActividad } from "../helpers/logger.js";

export const listarFavoritos = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT f.id, f.producto_id,
                    p.nombre AS producto_nombre,
                    p.descripcion_corta AS producto_descripcion,
                    p.imagen AS producto_imagen,
                    p.precio,
                    p.etiqueta
             FROM favoritos f
                      JOIN productos p ON p.id = f.producto_id
             WHERE f.cliente_id = $1
             ORDER BY f.created_at DESC`,
            [req.session.usuario.id]
        );

        res.render('favoritos', { title: 'Lista de deseos', favoritos: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /favoritos - ERROR: ${error.message}`);
        next(error);
    }
};