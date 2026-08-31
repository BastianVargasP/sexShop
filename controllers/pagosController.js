import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

/* ==================== Listado ==================== */

export const listar = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM metodos_pago WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        res.render('pagos', { title: 'Métodos de pago', metodosPago: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /pagos - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Crear ==================== */

export const mostrarFormularioNuevo = (req, res) => {
    res.render('nuevo-metodo-pago', { title: 'Nuevo método de pago' });
};

export const crear = async (req, res, next) => {
    try {
        const { marca, numeroTarjeta, vencimiento, titular, defaultMetodo } = req.body;

        if (!marca || !numeroTarjeta || !vencimiento || !titular) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Todos los campos son obligatorios.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const soloDigitos = numeroTarjeta.replace(/\D/g, '');
        if (soloDigitos.length < 4) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'El número de tarjeta ingresado no es válido.',
                error: { status: 400, stack: 'Revisa el número e intenta nuevamente.' }
            });
        }
        const ultimosDigitos = soloDigitos.slice(-4);
        
        if (defaultMetodo) {
            await pool.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        }

        await pool.query(
            `INSERT INTO metodos_pago (cliente_id, marca, ultimos_digitos, vencimiento, titular, predeterminada)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.session.usuario.id, marca, ultimosDigitos, vencimiento, titular, !!defaultMetodo]
        );

        registrarActividad(`💳 POST /nuevo-metodo-pago - ÉXITO: cliente #${req.session.usuario.id}.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /nuevo-metodo-pago - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Editar ==================== */

export const mostrarFormularioEditar = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return next();
        }

        res.render('editar-metodo-pago', { title: 'Editar método de pago', metodo: resultado.rows[0] });
    } catch (error) {
        registrarActividad(`❌ GET /pagos/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

export const editar = async (req, res, next) => {
    try {
        const { marca, vencimiento, titular, defaultMetodo } = req.body;

        if (!marca || !vencimiento || !titular) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Todos los campos son obligatorios.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const propietario = await pool.query(
            'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietario.rows.length === 0) {
            return next();
        }

        if (defaultMetodo) {
            await pool.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        }

        await pool.query(
            `UPDATE metodos_pago SET marca = $1, vencimiento = $2, titular = $3, predeterminada = $4
             WHERE id = $5 AND cliente_id = $6`,
            [marca, vencimiento, titular, !!defaultMetodo, req.params.id, req.session.usuario.id]
        );

        registrarActividad(`💳 POST /pagos/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /pagos/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Eliminar ==================== */

export const eliminar = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'DELETE FROM metodos_pago WHERE id = $1 AND cliente_id = $2 RETURNING id',
            [req.params.id, req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return next();
        }

        registrarActividad(`💳 POST /pagos/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /pagos/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};

/* ==================== Marcar predeterminado ==================== */

export const marcarPredeterminado = async (req, res, next) => {
    try {
        const propietario = await pool.query(
            'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietario.rows.length === 0) {
            return next();
        }

        await pool.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        await pool.query('UPDATE metodos_pago SET predeterminada = TRUE WHERE id = $1', [req.params.id]);

        registrarActividad(`💳 POST /pagos/${req.params.id}/predeterminada - ÉXITO.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /pagos/${req.params.id}/predeterminada - ERROR: ${error.message}`);
        next(error);
    }
};