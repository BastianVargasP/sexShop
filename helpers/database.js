import pg from 'pg';
import { config } from "../config/config.js";
import { registrarActividad } from "./logger.js";

const { Pool } = pg;

export const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: 10,                     // conexiones máximas simultáneas en el pool
    idleTimeoutMillis: 30000,    // cierra conexiones ociosas tras 30s
    connectionTimeoutMillis: 5000
});

registrarActividad('💾 BASE DE DATOS: Pool de PostgreSQL inicializado.');

// Un cliente inactivo del pool puede emitir error (ej. si Postgres lo corta).
// Sin este listener, Node tira el proceso entero.
pool.on('error', (error) => {
    registrarActividad(`💾❌ BASE DE DATOS (Pool): Error inesperado en cliente inactivo - ${error.message}`);
});

/**
 * Usar SOLO cuando necesitas varias queries dentro de una misma transacción
 * (BEGIN/COMMIT/ROLLBACK), porque deben ejecutarse sobre el mismo cliente físico.
 * Recuerda llamar siempre a `cliente.release()` en el finally.
 */
export const getDbClient = () => pool.connect();