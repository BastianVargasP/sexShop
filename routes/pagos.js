import express from 'express';
import * as pagosController from "../controllers/pagosController.js";
import {estaAutenticado} from "../middlewares/auth.js";
import {getDbClient} from "../helpers/database.js";
import {registrarActividad} from "../helpers/logger.js";

const router = express.Router();

router.get('/pagos', estaAutenticado, pagosController.listarPagos);

router.get('/nuevo-metodo-pago', estaAutenticado, pagosController.formularioNuevoMetodo);

router.post('/nuevo-metodo-pago', estaAutenticado, pagosController.nuevoMetodoPago);

router.get('/pagos/:id/editar', estaAutenticado, async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query(
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
    } finally {
        await conexion.end();
    }
});

router.post('/pagos/:id/editar', estaAutenticado, async (req, res, next) => {
    const conexion = getDbClient();
    try {
        const { marca, vencimiento, titular, defaultMetodo } = req.body;

        if (!marca || !vencimiento || !titular) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Todos los campos son obligatorios.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        await conexion.connect();

        const propietario = await conexion.query(
            'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietario.rows.length === 0) {
            return next();
        }

        if (defaultMetodo) {
            await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        }

        await conexion.query(
            `UPDATE metodos_pago SET marca = $1, vencimiento = $2, titular = $3, predeterminada = $4
       WHERE id = $5 AND cliente_id = $6`,
            [marca, vencimiento, titular, !!defaultMetodo, req.params.id, req.session.usuario.id]
        );

        registrarActividad(`💳 POST /pagos/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /pagos/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
});

router.post('/pagos/:id/eliminar', estaAutenticado, async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query(
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
    } finally {
        await conexion.end();
    }
});

router.post('/pagos/:id/predeterminada', estaAutenticado, async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();

        const propietario = await conexion.query(
            'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietario.rows.length === 0) {
            return next();
        }

        await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        await conexion.query('UPDATE metodos_pago SET predeterminada = TRUE WHERE id = $1', [req.params.id]);

        registrarActividad(`💳 POST /pagos/${req.params.id}/predeterminada - ÉXITO.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /pagos/${req.params.id}/predeterminada - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
});

export default router;