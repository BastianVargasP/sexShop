import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

const TIPOS_VALIDOS = ['porcentaje', 'monto_fijo', 'envio_gratis'];

const calcularEstado = (cupon) => {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!cupon.activo) return 'inactivo';
    if (cupon.fecha_fin && cupon.fecha_fin < hoy) return 'expirado';
    if (cupon.limite_usos !== null && Number(cupon.usos_realizados) >= cupon.limite_usos) return 'agotado';
    return 'activo';
};

const validarDatosCupon = ({ codigo, descripcion, tipo, valor, fechaInicio, fechaFin, limitePorCliente }) => {
    if (!codigo || !descripcion || !tipo || !fechaInicio) {
        return 'Código, descripción, tipo y fecha de inicio son obligatorios.';
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
        return 'El tipo de cupón no es válido.';
    }
    if (tipo !== 'envio_gratis' && (valor === undefined || valor === '' || Number(valor) <= 0)) {
        return 'El valor del descuento debe ser mayor a 0.';
    }
    if (tipo === 'porcentaje' && Number(valor) > 100) {
        return 'Un descuento porcentual no puede superar el 100%.';
    }
    if (fechaFin && fechaFin < fechaInicio) {
        return 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.';
    }
    if (limitePorCliente !== undefined && limitePorCliente !== '' && Number(limitePorCliente) < 1) {
        return 'El límite de usos por cliente debe ser al menos 1.';
    }
    return null;
};

/* ==================== Listado ==================== */

export const listarCupones = async (req, res, next) => {
    try {
        const { estado, busqueda } = req.query;

        const cuponesResult = await pool.query(
            `SELECT c.*, COALESCE(u.total_usos, 0) AS usos_realizados
             FROM cupones c
             LEFT JOIN (
                 SELECT cupon_id, COUNT(*) AS total_usos FROM cupones_usos GROUP BY cupon_id
             ) u ON u.cupon_id = c.id
             ORDER BY c.created_at DESC`
        );

        let cupones = cuponesResult.rows.map((c) => ({ ...c, estadoCalculado: calcularEstado(c) }));

        if (estado) {
            cupones = cupones.filter((c) => c.estadoCalculado === estado);
        }
        if (busqueda) {
            const termino = busqueda.toLowerCase();
            cupones = cupones.filter((c) =>
                c.codigo.toLowerCase().includes(termino) || c.descripcion.toLowerCase().includes(termino)
            );
        }

        const metricasResult = await pool.query(
            `SELECT
                 COUNT(*) FILTER (WHERE activo = TRUE) AS activos,
                 COUNT(*) AS total,
                 (SELECT COUNT(*) FROM cupones_usos WHERE created_at >= date_trunc('month', NOW())) AS usos_mes,
                 (SELECT COALESCE(SUM(descuento), 0) FROM pedidos WHERE cupon_id IS NOT NULL) AS total_descuentos
             FROM cupones`
        );

        res.render('admin/cupones', {
            titulo: 'Cupones',
            cupones,
            metricas: metricasResult.rows[0],
            filtros: { estado: estado || '', busqueda: busqueda || '' },
            cuponEditando: null
        });
    } catch (error) {
        registrarActividad(`❌ GET /admin/cupones - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Formulario de edición ==================== */

const renderConEdicion = async (res, cuponEditando) => {
    const cuponesResult = await pool.query(
        `SELECT c.*, COALESCE(u.total_usos, 0) AS usos_realizados
         FROM cupones c
         LEFT JOIN (
             SELECT cupon_id, COUNT(*) AS total_usos FROM cupones_usos GROUP BY cupon_id
         ) u ON u.cupon_id = c.id
         ORDER BY c.created_at DESC`
    );
    const cupones = cuponesResult.rows.map((c) => ({ ...c, estadoCalculado: calcularEstado(c) }));

    const metricasResult = await pool.query(
        `SELECT
             COUNT(*) FILTER (WHERE activo = TRUE) AS activos,
             COUNT(*) AS total,
             (SELECT COUNT(*) FROM cupones_usos WHERE created_at >= date_trunc('month', NOW())) AS usos_mes,
             (SELECT COALESCE(SUM(descuento), 0) FROM pedidos WHERE cupon_id IS NOT NULL) AS total_descuentos
         FROM cupones`
    );

    res.render('admin/cupones', {
        titulo: 'Cupones',
        cupones,
        metricas: metricasResult.rows[0],
        filtros: { estado: '', busqueda: '' },
        cuponEditando
    });
};

export const mostrarFormularioEditar = async (req, res, next) => {
    try {
        const resultado = await pool.query('SELECT * FROM cupones WHERE id = $1', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        await renderConEdicion(res, resultado.rows[0]);
    } catch (error) {
        registrarActividad(`❌ GET /admin/cupones/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Crear ==================== */

export const crearCupon = async (req, res, next) => {
    try {
        const { codigo, descripcion, tipo, valor, compraMinima, topeMaximo, fechaInicio, fechaFin, limiteUsos, limitePorCliente, activo } = req.body;

        const errorValidacion = validarDatosCupon({ codigo, descripcion, tipo, valor, fechaInicio, fechaFin, limitePorCliente });
        if (errorValidacion) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: errorValidacion,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        await pool.query(
            `INSERT INTO cupones (codigo, descripcion, tipo, valor, compra_minima, tope_maximo, fecha_inicio, fecha_fin, limite_usos, limite_por_cliente, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                codigo.trim().toUpperCase(),
                descripcion,
                tipo,
                tipo === 'envio_gratis' ? 0 : valor,
                compraMinima || 0,
                tipo === 'porcentaje' && topeMaximo ? topeMaximo : null,
                fechaInicio,
                fechaFin || null,
                limiteUsos || null,
                limitePorCliente || 1,
                activo !== undefined
            ]
        );

        registrarActividad(`🏷️ POST /admin/cupones - ÉXITO: cupón "${codigo}" creado.`);
        res.redirect('/admin/cupones');
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'Ya existe un cupón con ese código.',
                error: { status: 409, stack: 'Elige un código distinto.' }
            });
        }
        registrarActividad(`🏷️❌ POST /admin/cupones - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Editar (el código no se puede modificar) ==================== */

export const actualizarCupon = async (req, res, next) => {
    try {
        const { descripcion, tipo, valor, compraMinima, topeMaximo, fechaInicio, fechaFin, limiteUsos, limitePorCliente, activo } = req.body;

        const errorValidacion = validarDatosCupon({ codigo: 'x', descripcion, tipo, valor, fechaInicio, fechaFin, limitePorCliente });
        if (errorValidacion) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: errorValidacion,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const resultado = await pool.query(
            `UPDATE cupones
             SET descripcion = $1, tipo = $2, valor = $3, compra_minima = $4, tope_maximo = $5,
                 fecha_inicio = $6, fecha_fin = $7, limite_usos = $8, limite_por_cliente = $9, activo = $10
             WHERE id = $11
             RETURNING id`,
            [
                descripcion,
                tipo,
                tipo === 'envio_gratis' ? 0 : valor,
                compraMinima || 0,
                tipo === 'porcentaje' && topeMaximo ? topeMaximo : null,
                fechaInicio,
                fechaFin || null,
                limiteUsos || null,
                limitePorCliente || 1,
                activo !== undefined,
                req.params.id
            ]
        );

        if (resultado.rows.length === 0) return next();

        registrarActividad(`🏷️ POST /admin/cupones/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/admin/cupones');
    } catch (error) {
        registrarActividad(`🏷️❌ POST /admin/cupones/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Activar / Desactivar ==================== */

export const alternarActivo = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'UPDATE cupones SET activo = NOT activo WHERE id = $1 RETURNING id, activo',
            [req.params.id]
        );
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🏷️ POST /admin/cupones/${req.params.id}/activar - ÉXITO: ahora ${resultado.rows[0].activo ? 'ACTIVO' : 'INACTIVO'}.`);
        res.redirect('/admin/cupones');
    } catch (error) {
        registrarActividad(`🏷️❌ POST /admin/cupones/${req.params.id}/activar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar ==================== */

export const eliminarCupon = async (req, res, next) => {
    try {
        const resultado = await pool.query('DELETE FROM cupones WHERE id = $1 RETURNING id', [req.params.id]);
        if (resultado.rows.length === 0) return next();

        registrarActividad(`🏷️ POST /admin/cupones/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/admin/cupones');
    } catch (error) {
        if (error.code === '23503') {
            return res.status(409).render('error', {
                ok: false,
                mensaje: 'No se puede eliminar: este cupón ya fue usado en pedidos. Desactívalo en su lugar.',
                error: { status: 409, stack: 'Los pedidos históricos necesitan conservar la referencia al cupón.' }
            });
        }
        registrarActividad(`🏷️❌ POST /admin/cupones/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};