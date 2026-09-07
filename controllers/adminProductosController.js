import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { generarSku } from '../helpers/sku.js';

const MAX_INTENTOS_SKU = 3;

const parsearCaracteristicas = (texto) => {
    if (!texto) return [];
    return texto
        .split('\n')
        .map((linea) => linea.trim())
        .filter((linea) => linea.length > 0);
};

const validarDatosProducto = ({ nombre, descripcion, categoriaId, precio, stock }) => {
    if (!nombre || !descripcion || !categoriaId || !precio) {
        return 'Nombre, descripción, categoría y precio son obligatorios.';
    }
    if (Number(precio) < 0) {
        return 'El precio no puede ser negativo.';
    }
    if (stock !== undefined && stock !== '' && Number(stock) < 0) {
        return 'El stock no puede ser negativo.';
    }
    return null;
};

const obtenerCategoriasYSubcategorias = async () => {
    const categoriasResult = await pool.query('SELECT * FROM categorias ORDER BY orden ASC, nombre ASC');
    const subcategoriasResult = await pool.query('SELECT * FROM subcategorias ORDER BY orden ASC, nombre ASC');
    return { categorias: categoriasResult.rows, subcategorias: subcategoriasResult.rows };
};

/**
 * Valida que la categoría exista y, si viene subcategoría, que
 * pertenezca efectivamente a esa categoría. Devuelve la fila de
 * la categoría (la necesitamos para generar el SKU) o null si algo no calza.
 */
const validarCategoriaYSubcategoria = async (categoriaId, subcategoriaId) => {
    const categoriaResult = await pool.query('SELECT * FROM categorias WHERE id = $1', [categoriaId]);
    if (categoriaResult.rows.length === 0) return { error: 'La categoría seleccionada no existe.' };

    if (subcategoriaId) {
        const subResult = await pool.query(
            'SELECT id FROM subcategorias WHERE id = $1 AND categoria_id = $2',
            [subcategoriaId, categoriaId]
        );
        if (subResult.rows.length === 0) {
            return { error: 'La subcategoría seleccionada no pertenece a la categoría elegida.' };
        }
    }

    return { categoria: categoriaResult.rows[0] };
};

/* ==================== Listado (con filtros) ==================== */

export const listarProductos = async (req, res, next) => {
    try {
        const { categoriaId, busqueda, estado } = req.query;
        const condiciones = [];
        const valores = [];

        if (categoriaId) {
            valores.push(categoriaId);
            condiciones.push(`p.categoria_id = $${valores.length}`);
        }
        if (busqueda) {
            valores.push(`%${busqueda}%`);
            condiciones.push(`(p.nombre ILIKE $${valores.length} OR p.sku ILIKE $${valores.length})`);
        }
        if (estado === 'activo') {
            condiciones.push('p.activo = TRUE');
        } else if (estado === 'inactivo') {
            condiciones.push('p.activo = FALSE');
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const resultado = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre, s.nombre AS subcategoria_nombre
             FROM productos p
                      LEFT JOIN categorias c ON c.id = p.categoria_id
                      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
                 ${where}
             ORDER BY p.destacado DESC, p.created_at DESC`,
            valores
        );

        const { categorias, subcategorias } = await obtenerCategoriasYSubcategorias();

        res.render('admin/productos', {
            titulo: 'Productos',
            productos: resultado.rows,
            categorias,
            subcategorias,
            filtros: { categoriaId: categoriaId || '', busqueda: busqueda || '', estado: estado || '' },
            productoEditando: null
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/productos - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Formulario de edición ==================== */

export const mostrarFormularioEditar = async (req, res, next) => {
    try {
        const productoResult = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
        if (productoResult.rows.length === 0) return next();

        const todosResult = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre, s.nombre AS subcategoria_nombre
             FROM productos p
                      LEFT JOIN categorias c ON c.id = p.categoria_id
                      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
             ORDER BY p.destacado DESC, p.created_at DESC`
        );

        const { categorias, subcategorias } = await obtenerCategoriasYSubcategorias();

        res.render('admin/productos', {
            titulo: 'Editar producto',
            productos: todosResult.rows,
            categorias,
            subcategorias,
            filtros: { categoriaId: '', busqueda: '', estado: '' },
            productoEditando: productoResult.rows[0]
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/productos/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Crear (SKU generado a partir de la categoría real) ==================== */

export const crearProducto = async (req, res, next) => {
    const { nombre, descripcion, descripcionCorta, categoriaId, subcategoriaId, precio, marca, stock, imagen, etiqueta, caracteristicas, destacado } = req.body;

    const errorValidacion = validarDatosProducto({ nombre, descripcion, categoriaId, precio, stock });
    if (errorValidacion) {
        return res.status(400).render('error', {
            ok: false,
            mensaje: errorValidacion,
            error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
        });
    }

    const { categoria, error: errorCategoria } = await validarCategoriaYSubcategoria(categoriaId, subcategoriaId || null);
    if (errorCategoria) {
        return res.status(400).render('error', {
            ok: false,
            mensaje: errorCategoria,
            error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
        });
    }

    for (let intento = 1; intento <= MAX_INTENTOS_SKU; intento++) {
        const sku = generarSku(categoria.nombre);
        try {
            await pool.query(
                `INSERT INTO productos (nombre, descripcion, descripcion_corta, categoria_id, subcategoria_id, precio, marca, stock, imagen, etiqueta, caracteristicas, destacado, sku, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)`,
                [
                    nombre,
                    descripcion,
                    descripcionCorta || null,
                    categoriaId,
                    subcategoriaId || null,
                    precio,
                    marca || null,
                    stock === '' || stock === undefined ? 0 : stock,
                    imagen || null,
                    etiqueta || null,
                    parsearCaracteristicas(caracteristicas),
                    !!destacado,
                    sku
                ]
            );

            registrarActividad(`🛍️ POST /admin/productos - ÉXITO: producto "${nombre}" creado (SKU ${sku}).`);
            return res.redirect('/admin/productos');
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'productos_sku_key' && intento < MAX_INTENTOS_SKU) {
                continue;
            }
            registrarActividad(`🛍️❌ POST /admin/productos - ERROR: ${error.message}`);
            return next(error);
        }
    }
};

/* ==================== Editar (SKU nunca se toca; categoría sí se puede cambiar) ==================== */

export const actualizarProducto = async (req, res, next) => {
    try {
        const { nombre, descripcion, descripcionCorta, categoriaId, subcategoriaId, precio, marca, stock, imagen, etiqueta, caracteristicas, destacado } = req.body;

        const errorValidacion = validarDatosProducto({ nombre, descripcion, categoriaId, precio, stock });
        if (errorValidacion) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: errorValidacion,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const { error: errorCategoria } = await validarCategoriaYSubcategoria(categoriaId, subcategoriaId || null);
        if (errorCategoria) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: errorCategoria,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const resultado = await pool.query(
            `UPDATE productos
             SET nombre = $1, descripcion = $2, descripcion_corta = $3, categoria_id = $4, subcategoria_id = $5,
                 precio = $6, marca = $7, stock = $8, imagen = $9, etiqueta = $10, caracteristicas = $11, destacado = $12
             WHERE id = $13
                 RETURNING id`,
            [
                nombre,
                descripcion,
                descripcionCorta || null,
                categoriaId,
                subcategoriaId || null,
                precio,
                marca || null,
                stock === '' || stock === undefined ? 0 : stock,
                imagen || null,
                etiqueta || null,
                parsearCaracteristicas(caracteristicas),
                !!destacado,
                req.params.id
            ]
        );

        if (resultado.rows.length === 0) return next();

        registrarActividad(`🛍️ POST /admin/productos/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/admin/productos');
    } catch (error) {
        registrarActividad(`🛍️❌ POST /admin/productos/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Activar / Desactivar ==================== */

export const alternarActivo = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `UPDATE productos SET activo = NOT activo WHERE id = $1 RETURNING id, activo`,
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🛍️ POST /admin/productos/${req.params.id}/activar - ÉXITO: ahora ${resultado.rows[0].activo ? 'ACTIVO' : 'INACTIVO'}.`);
        res.redirect('/admin/productos');
    } catch (error) {
        registrarActividad(`🛍️❌ POST /admin/productos/${req.params.id}/activar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar ==================== */

export const eliminarProducto = async (req, res, next) => {
    try {
        const resultado = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🛍️ POST /admin/productos/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/admin/productos');
    } catch (error) {
        if (error.code === '23503') {
            registrarActividad(`🛍️❌ POST /admin/productos/${req.params.id}/eliminar - RECHAZADO: producto referenciado.`);
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'No se puede eliminar: el producto está en carritos, favoritos o pedidos de clientes. Puedes desactivarlo en su lugar.',
                error: { status: 409, stack: 'Quita esas referencias antes de eliminarlo, o usa el botón Desactivar.' }
            });
        }
        registrarActividad(`🛍️❌ POST /admin/productos/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};