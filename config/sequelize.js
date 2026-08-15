import {Sequelize} from 'sequelize';
import {config} from './config.js';
import {registrarActividad} from '../helpers/logger.js';

registrarActividad('💾 BASE DE DATOS (Sequelize): Intentando establecer conexión con PostgreSQL...');

export const sequelize = new Sequelize(
    config.db.database,
    config.db.user,
    config.db.password,
    {
        host: config.db.host,
        port: config.db.port,
        dialect: 'postgres',
        benchmark: true,
        logging: (sql, timing) => registrarActividad(`💾 SQL (ORM Sequelize) [${timing}ms]: ${sql}`),
    }
);