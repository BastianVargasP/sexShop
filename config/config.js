import dotenv from 'dotenv';
import {registrarActividad} from "../helpers/logger.js";

dotenv.config();

const REQUIRED_ENV_VARS = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'SESSION_SECRET'
];

REQUIRED_ENV_VARS.forEach((envVar) => {
    if(!process.env[envVar]){
        console.error(`❌ ERROR: Falta la variable de entorno obligatoria -> ${envVar}`);
        // Preocuparme por guardar estos registros (logs) se llama OBSERVABILIDAD
        registrarActividad(`❌ SISTEMA ERROR: Falta la variable de entorno obligatoria -> ${envVar}`);
        process.exit(1);
    }
});

export const config = {
    db: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    },
    email: {
        email: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
    },
    session: {
        secret: process.env.SESSION_SECRET,
    }
};