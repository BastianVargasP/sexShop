import { getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

export const verPerfil = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        await conexion.connect();
        const resultado = await conexion.query(
            'SELECT id, nombre, apellido, email, telefono FROM clientes WHERE id = $1',
            [req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return req.session.destroy(() => res.redirect('/auth/login'));
        }

        res.render('perfil', { title: 'Mis datos', cliente: resultado.rows[0] });
    } catch (error) {
        registrarActividad(`❌ GET /perfil - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};

export const actualizarPerfil = async (req, res, next) => {
    const conexion = getDbClient();
    try {
        const { firstName, lastName, phone } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Nombre y apellido son obligatorios.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        await conexion.connect();
        await conexion.query(
            'UPDATE clientes SET nombre = $1, apellido = $2, telefono = $3 WHERE id = $4',
            [firstName, lastName, phone, req.session.usuario.id]
        );

        req.session.usuario.nombre = firstName;
        req.session.usuario.apellido = lastName;

        registrarActividad(`👤 POST /perfil - ÉXITO: Datos actualizados (cliente #${req.session.usuario.id}).`);
        res.redirect('/perfil');
    } catch (error) {
        registrarActividad(`👤❌ POST /perfil - ERROR: ${error.message}`);
        next(error);
    } finally {
        await conexion.end();
    }
};