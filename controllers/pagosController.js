import {getDbClient} from "../helpers/database.js";
import {registrarActividad} from "../helpers/logger.js";

export const listarPagos = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query(
            'SELECT * FROM metodos_pago WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        res.render('pagos', { title: 'Métodos de pago', metodosPago: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /pagos - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};

export const formularioNuevoMetodo = async (req, res, next) => {
    res.render('nuevo-metodo-pago', { title: 'Nuevo método de pago' });
};

export const nuevoMetodoPago = async (req, res, next) => {
    const conexion = getDbClient();
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

        await conexion.connect();

        if (defaultMetodo) {
            await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        }

        await conexion.query(
            `INSERT INTO metodos_pago (cliente_id, marca, ultimos_digitos, vencimiento, titular, predeterminada)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.session.usuario.id, marca, ultimosDigitos, vencimiento, titular, !!defaultMetodo]
        );

        registrarActividad(`💳 POST /nuevo-metodo-pago - ÉXITO: cliente #${req.session.usuario.id}.`);
        res.redirect('/pagos');
    } catch (error) {
        registrarActividad(`💳❌ POST /nuevo-metodo-pago - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};