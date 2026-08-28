import bcrypt from 'bcryptjs';
import validator from 'validator';

import { registrarActividad } from '../helpers/logger.js';
import { getDbClient } from '../helpers/database.js';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos.';

export const mostrarLogin = (req, res) => {
    res.render('login');
};

export const mostrarRegistro = (req, res) => {
    res.render('registro');
};

export const procesarLogin = async (req, res) => {
    const conexion = getDbClient();
    try {
        const { email, password } = req.body;

        if (!validator.isEmail(email) || !password) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: MENSAJE_CREDENCIALES_INVALIDAS,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        await conexion.connect();
        const resultado = await conexion.query(
            'SELECT id, nombre, apellido, email, password_hash, telefono FROM clientes WHERE email = $1',
            [email]
        );

        if (resultado.rows.length === 0) {
            registrarActividad(`🔐❌ POST /autenticacion/login - RECHAZADO: Email no registrado (${email}).`);
            return res.status(401).render('error', {
                ok: false,
                mensaje: MENSAJE_CREDENCIALES_INVALIDAS,
                error: { status: 401, stack: 'Verifica tus datos e intenta nuevamente.' }
            });
        }

        const usuario = resultado.rows[0];
        const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordCorrecta) {
            registrarActividad(`🔐❌ POST /autenticacion/login - RECHAZADO: Contraseña incorrecta (${email}).`);
            return res.status(401).render('error', {
                ok: false,
                mensaje: MENSAJE_CREDENCIALES_INVALIDAS,
                error: { status: 401, stack: 'Verifica tus datos e intenta nuevamente.' }
            });
        }

        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            telefono: usuario.telefono
        };

        registrarActividad(`🔐 POST /autenticacion/login - ÉXITO: Sesión iniciada para ${email}.`);
        res.redirect('/');
    } catch (error) {
        registrarActividad(`🔐❌ POST /autenticacion/login - ERROR CRÍTICO: ${error.message}`);
        res.status(500).render('error', {
            ok: false,
            mensaje: 'Ocurrió un error al iniciar sesión.',
            error: { status: 500, stack: error.message }
        });
    } finally {
        await conexion.end();
    }
};

export const procesarRegistro = async (req, res) => {
    const conexion = getDbClient();
    try {
        const { nombre, apellido, email, password, telefono } = req.body;

        if (!nombre || !apellido || !validator.isEmail(email) || !password || !telefono) {
            registrarActividad(`🔐❌ POST /autenticacion/registro - RECHAZADO: Datos incompletos o email inválido.`);
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Debes completar todos los campos con datos válidos.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        if (password.length < 6) {
            registrarActividad(`🔐❌ POST /autenticacion/registro - RECHAZADO: Contraseña demasiado corta (${email}).`);
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'La contraseña debe tener al menos 6 caracteres.',
                error: { status: 400, stack: 'Elige una contraseña más larga.' }
            });
        }

        registrarActividad(`🔐 SEGURIDAD: Hasheando contraseña para nuevo registro (${email}).`);
        const passwordHash = await bcrypt.hash(password, 10);

        await conexion.connect();
        const insertSql = `
            INSERT INTO clientes (nombre, apellido, email, password_hash, telefono)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, nombre, apellido, email, telefono
        `;
        const valores = [validator.escape(nombre), validator.escape(apellido), email, passwordHash, telefono];
        await conexion.query(insertSql, valores);

        registrarActividad(`🔐 POST /autenticacion/registro - ÉXITO: Usuario registrado correctamente (${email}).`);
        res.redirect('/auth/login');
    } catch (error) {
        let mensajeError = `Error crítico: ${error.message}`;
        let statusCode = 500;

        if (error.code === '23505') {
            mensajeError = 'Ese correo electrónico ya está registrado. Intenta iniciar sesión.';
            statusCode = 409;
            registrarActividad(`🔐❌ POST /autenticacion/registro - RECHAZADO: Email duplicado (${req.body.email}).`);
        } else {
            registrarActividad(`🔐❌ POST /autenticacion/registro - ERROR CRÍTICO: ${error.message}`);
        }

        res.status(statusCode).render('error', {
            ok: false,
            mensaje: mensajeError,
            error: { status: statusCode, stack: error.message }
        });
    } finally {
        await conexion.end();
    }
};

export const procesarLogout = (req, res) => {
    const email = req.session.usuario?.email;
    req.session.destroy((err) => {
        if (err) {
            registrarActividad(`🔐❌ GET /autenticacion/logout - ERROR: ${err.message}`);
        } else {
            registrarActividad(`🔐 GET /autenticacion/logout - ÉXITO: Sesión cerrada (${email}).`);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};