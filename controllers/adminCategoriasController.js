import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { generarSlugUnico } from '../helpers/slug.js';
import { quiereJson } from '../helpers/peticiones.js';

/* ==================== Listado (categorías + subcategorías) ==================== */

export const listarCategorias = async (req, res, next) => {
    try {
        const categoriasResult = await pool.query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM subcategorias s WHERE s.categoria_id = c.id) AS total_subcategorias,
                    (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS total_productos
             FROM categorias c
             ORDER BY c.orden ASC, c.created_at ASC`
        );

        const subcategoriasResult = await pool.query(
            `SELECT s.*, c.nombre AS categoria_nombre,
                    (SELECT COUNT(*) FROM productos p WHERE p.subcategoria_id = s.id) AS total_productos
             FROM subcategorias s
             JOIN categorias c ON c.id = s.categoria_id
             ORDER BY c.orden ASC, s.orden ASC, s.created_at ASC`
        );

        res.render('admin/categorias', {
            titulo: 'Categorías',
            categorias: categoriasResult.rows,
            subcategorias: subcategoriasResult.rows,
            categoriaEditando: null,
            subcategoriaEditando: null
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/categorias - ERROR: ${error.message}`);
        next(error);
    }
};

const renderConEdicion = async (res, { categoriaEditando = null, subcategoriaEditando = null }) => {
    const categoriasResult = await pool.query(
        `SELECT c.*,
                (SELECT COUNT(*) FROM subcategorias s WHERE s.categoria_id = c.id) AS total_subcategorias,
                (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS total_productos
         FROM categorias c
         ORDER BY c.orden ASC, c.created_at ASC`
    );
    const subcategoriasResult = await pool.query(
        `SELECT s.*, c.nombre AS categoria_nombre,
                (SELECT COUNT(*) FROM productos p WHERE p.subcategoria_id = s.id) AS total_productos
         FROM subcategorias s
         JOIN categorias c ON c.id = s.categoria_id
         ORDER BY c.orden ASC, s.orden ASC, s.created_at ASC`
    );

    res.render('admin/categorias', {
        titulo: 'Categorías',
        categorias: categoriasResult.rows,
        subcategorias: subcategoriasResult.rows,
        categoriaEditando,
        subcategoriaEditando
    });
};

/* ==================== Formularios de edición (abren el modal precargado) ==================== */

export const mostrarFormularioEditarCategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query('SELECT * FROM categorias WHERE id = $1', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        await renderConEdicion(res, { categoriaEditando: resultado.rows[0] });
    } catch (error) {
        registrarActividad(`❌ GET /admin/categorias/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

export const mostrarFormularioEditarSubcategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query('SELECT * FROM subcategorias WHERE id = $1', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        await renderConEdicion(res, { subcategoriaEditando: resultado.rows[0] });
    } catch (error) {
        registrarActividad(`❌ GET /admin/subcategorias/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Crear categoría ==================== */

export const crearCategoria = async (req, res, next) => {
    try {
        const { nombre, descripcion, imagen, activa } = req.body;

        if (!nombre) {
            const mensaje = 'El nombre de la categoría es obligatorio.';
            if (quiereJson(req)) return res.status(400).json({ ok: false, error: mensaje });
            return res.status(400).render('error', {
                ok: false, mensaje,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const slug = await generarSlugUnico(nombre, async (slugCandidato) => {
            const existe = await pool.query('SELECT id FROM categorias WHERE slug = $1', [slugCandidato]);
            return existe.rows.length > 0;
        });

        const ordenResult = await pool.query('SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM categorias');
        const siguienteOrden = ordenResult.rows[0].siguiente;

        const insertResult = await pool.query(
            `INSERT INTO categorias (nombre, slug, descripcion, imagen, orden, activa)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, slug, activa`,
            [nombre, slug, descripcion || null, imagen || null, siguienteOrden, activa !== undefined]
        );

        registrarActividad(`📂 POST /admin/categorias - ÉXITO: categoría "${nombre}" creada (slug ${slug}).`);

        if (quiereJson(req)) return res.json({ ok: true, categoria: insertResult.rows[0] });
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/categorias - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false, error: 'No se pudo crear la categoría.' });
        next(error);
    }
};

/* ==================== Editar categoría (el slug no cambia) ==================== */

export const actualizarCategoria = async (req, res, next) => {
    try {
        const { nombre, descripcion, imagen, activa } = req.body;

        if (!nombre) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'El nombre de la categoría es obligatorio.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const resultado = await pool.query(
            `UPDATE categorias SET nombre = $1, descripcion = $2, imagen = $3, activa = $4
             WHERE id = $5 RETURNING id`,
            [nombre, descripcion || null, imagen || null, activa !== undefined, req.params.id]
        );

        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/categorias/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/categorias/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Activar / Desactivar categoría ==================== */

export const alternarActivoCategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'UPDATE categorias SET activa = NOT activa WHERE id = $1 RETURNING id, activa',
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/categorias/${req.params.id}/activar - ÉXITO: ahora ${resultado.rows[0].activa ? 'ACTIVA' : 'INACTIVA'}.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/categorias/${req.params.id}/activar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar categoría ==================== */

export const eliminarCategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query('DELETE FROM categorias WHERE id = $1 RETURNING id', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/categorias/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        if (error.code === '23503') {
            registrarActividad(`📂❌ POST /admin/categorias/${req.params.id}/eliminar - RECHAZADO: categoría referenciada.`);
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'No se puede eliminar: hay productos asignados a esta categoría o a sus subcategorías. Desactívala en su lugar.',
                error: { status: 409, stack: 'Reasigna o quita esos productos antes de eliminarla.' }
            });
        }
        registrarActividad(`📂❌ POST /admin/categorias/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Reordenar categorías (drag & drop) ==================== */

export const actualizarOrdenCategorias = async (req, res) => {
    try {
        const { ids } = req.body; // array de IDs en el nuevo orden
        if (!Array.isArray(ids)) {
            return res.status(400).json({ ok: false, error: 'Formato inválido.' });
        }

        await Promise.all(
            ids.map((id, index) => pool.query('UPDATE categorias SET orden = $1 WHERE id = $2', [index, id]))
        );

        registrarActividad(`📂 POST /admin/categorias/orden - ÉXITO: ${ids.length} categorías reordenadas.`);
        res.json({ ok: true });
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/categorias/orden - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar el orden.' });
    }
};

/* ==================== Crear subcategoría ==================== */

export const crearSubcategoria = async (req, res, next) => {
    try {
        const { nombre, categoriaId, imagen, activa } = req.body;

        if (!nombre || !categoriaId) {
            const mensaje = 'El nombre y la categoría principal son obligatorios.';
            if (quiereJson(req)) return res.status(400).json({ ok: false, error: mensaje });
            return res.status(400).render('error', {
                ok: false, mensaje,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const categoriaPadre = await pool.query('SELECT id FROM categorias WHERE id = $1', [categoriaId]);
        if (categoriaPadre.rows.length === 0) {
            const mensaje = 'La categoría principal seleccionada no existe.';
            if (quiereJson(req)) return res.status(400).json({ ok: false, error: mensaje });
            return res.status(400).render('error', {
                ok: false, mensaje,
                error: { status: 400, stack: 'Selecciona una categoría válida.' }
            });
        }

        const slug = await generarSlugUnico(nombre, async (slugCandidato) => {
            const existe = await pool.query(
                'SELECT id FROM subcategorias WHERE categoria_id = $1 AND slug = $2',
                [categoriaId, slugCandidato]
            );
            return existe.rows.length > 0;
        });

        const ordenResult = await pool.query(
            'SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM subcategorias WHERE categoria_id = $1',
            [categoriaId]
        );
        const siguienteOrden = ordenResult.rows[0].siguiente;

        const insertResult = await pool.query(
            `INSERT INTO subcategorias (categoria_id, nombre, slug, imagen, orden, activa)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, categoria_id, activa`,
            [categoriaId, nombre, slug, imagen || null, siguienteOrden, activa !== undefined]
        );

        registrarActividad(`📂 POST /admin/subcategorias - ÉXITO: subcategoría "${nombre}" creada.`);

        if (quiereJson(req)) return res.json({ ok: true, subcategoria: insertResult.rows[0] });
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/subcategorias - ERROR: ${error.message}`);
        if (quiereJson(req)) return res.status(500).json({ ok: false, error: 'No se pudo crear la subcategoría.' });
        next(error);
    }
};

/* ==================== Editar subcategoría ==================== */

export const actualizarSubcategoria = async (req, res, next) => {
    try {
        const { nombre, categoriaId, imagen, activa } = req.body;

        if (!nombre || !categoriaId) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'El nombre y la categoría principal son obligatorios.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const resultado = await pool.query(
            `UPDATE subcategorias SET nombre = $1, categoria_id = $2, imagen = $3, activa = $4
             WHERE id = $5 RETURNING id`,
            [nombre, categoriaId, imagen || null, activa !== undefined, req.params.id]
        );

        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/subcategorias/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/subcategorias/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Activar / Desactivar subcategoría ==================== */

export const alternarActivoSubcategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'UPDATE subcategorias SET activa = NOT activa WHERE id = $1 RETURNING id, activa',
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/subcategorias/${req.params.id}/activar - ÉXITO: ahora ${resultado.rows[0].activa ? 'ACTIVA' : 'INACTIVA'}.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/subcategorias/${req.params.id}/activar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar subcategoría ==================== */

export const eliminarSubcategoria = async (req, res, next) => {
    try {
        const resultado = await pool.query('DELETE FROM subcategorias WHERE id = $1 RETURNING id', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        registrarActividad(`📂 POST /admin/subcategorias/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/admin/categorias');
    } catch (error) {
        if (error.code === '23503') {
            registrarActividad(`📂❌ POST /admin/subcategorias/${req.params.id}/eliminar - RECHAZADO: subcategoría referenciada.`);
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'No se puede eliminar: hay productos asignados a esta subcategoría. Desactívala en su lugar.',
                error: { status: 409, stack: 'Reasigna o quita esos productos antes de eliminarla.' }
            });
        }
        registrarActividad(`📂❌ POST /admin/subcategorias/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Reordenar subcategorías (dentro de su categoría padre) ==================== */

export const actualizarOrdenSubcategorias = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ ok: false, error: 'Formato inválido.' });
        }

        await Promise.all(
            ids.map((id, index) => pool.query('UPDATE subcategorias SET orden = $1 WHERE id = $2', [index, id]))
        );

        registrarActividad(`📂 POST /admin/subcategorias/orden - ÉXITO: ${ids.length} subcategorías reordenadas.`);
        res.json({ ok: true });
    } catch (error) {
        registrarActividad(`📂❌ POST /admin/subcategorias/orden - ERROR: ${error.message}`);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar el orden.' });
    }
};