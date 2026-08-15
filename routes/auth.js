import express from 'express';
import validator from 'validator';
import bcrypt from 'bcryptjs';

import {registrarActividad} from "../helpers/logger.js";
import {getDbClient} from "../helpers/database.js";
import { estaAutenticado, esInvitado } from "../middlewares/auth.js";

const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/registro', (req, res) => {
    res.render('registro');
});

router.post('/login', async (req, res) => {
    const conexion = getDbClient();
    const mensajeCredencialesInvalidas = 'Email o contraseña incorrectos.';

    try {
        const { email, password } = req.body;

        if (!validator.isEmail(email) || !password) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: mensajeCredencialesInvalidas,
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.'}
            });
        }

        await conexion.connect();
        const consultaSQL = 'SELECT id, nombre, apellido, email, password_hash, telefono FROM clientes WHERE email = $1';
        const resultado = await conexion.query(consultaSQL, [email]);
        console.log('linea 37');

        if (resultado.rows.length === 0) {
            registrarActividad(`🔐❌ POST /autenticacion/login - RECHAZADO: Email no registrado (${email}).`);
            return res.status(401).render('error', {
                ok: false,
                mensaje: mensajeCredencialesInvalidas,
                error: { status: 401, stack: 'Verifica tus datos e intenta nuevamente.'}
            });
        }

        const usuario = resultado.rows[0];
        const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);
        console.log('linea 50');

        if (!passwordCorrecta) {
            registrarActividad(`🔐❌ POST /autenticacion/login - RECHAZADO: Contraseña incorrecta (${email}).`);
            return res.status(401).render('error', {
                ok: false,
                mensaje: mensajeCredencialesInvalidas,
                error: { status: 401, stack: 'Verifica tus datos e intenta nuevamente.'}
            });
        }
        console.log('linea 60');

        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email
        };
        console.log('linea 67');
        registrarActividad(`🔐 POST /autenticacion/login - ÉXITO: Sesión iniciada para ${email}.`);
        console.log('linea 69');
        res.redirect('/');

    } catch (error) {

    }
});

router.post('/registro', async (req, res) => {
    const conexion = getDbClient();
    try {
        const { nombre, apellido, email, password, telefono } = req.body;

        // 1. Validaciones básicas de entrada
        if( !nombre || !apellido || !validator.isEmail(email) || !password || !telefono ) {
            registrarActividad(`🔐❌ POST /autenticacion/registro - RECHAZADO: Datos incompletos o email inválido (${nombre},${apellido},${email},${password},${telefono}).`);
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'Debes completar todos los campos con datos válidos.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.'}
            });
        }

        if(password.length < 6) {
            registrarActividad(`🔐❌ POST /autenticacion/registro - RECHAZADO: Contraseña demasiado corta (${email}).`);
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'La contraseña debe tener al menos 6 caracteres.',
                error: { status: 400, stack: 'Elige una contraseña más larga.'}
            });
        }

        // 2. Hasheo de la contraseña -- esto es lo único que llegará a la base de datos
        registrarActividad(`🔐 SEGURIDAD: Hasheando contraseña para nuevo registro (${email}).`);
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Inserción en PostgreSQL (mismo patrón que ya usas en routes/index.js)
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
        let mensajeError = `Error crítico: ${error.message}`
        let statusCode = 500;

        if(error.code === '23505') {
            mensajeError = 'Ese correo electrónico ya está registrado. Intenta iniciar sesión.'
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
});

export default router;