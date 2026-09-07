import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../helpers/database.js';

// Uso: node scripts/crearAdmin.js "Nombre" "Apellido" correo@dominio.cl "ClaveSegura123" "912345678"
const [, , nombre, apellido, email, password, telefono] = process.argv;

if (!nombre || !apellido || !email || !password) {
    console.error('Uso: node scripts/crearAdmin.js <nombre> <apellido> <email> <password> [telefono]');
    process.exit(1);
}

const crearAdmin = async () => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);

        // 'admin' va hardcodeado en el SQL: nunca proviene de un input de usuario web
        const resultado = await pool.query(
            `INSERT INTO clientes (nombre, apellido, email, password_hash, telefono, rol)
             VALUES ($1, $2, $3, $4, $5, 'admin')
             ON CONFLICT (email) DO UPDATE SET rol = 'admin', password_hash = EXCLUDED.password_hash
             RETURNING id, nombre, apellido, email, rol`,
            [nombre, apellido, email, passwordHash, telefono || null]
        );

        console.log('✅ Administrador creado/actualizado:', resultado.rows[0]);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando administrador:', error.message);
        process.exit(1);
    }
};

crearAdmin();