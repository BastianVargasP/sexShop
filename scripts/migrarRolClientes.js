import 'dotenv/config';
import { pool } from '../helpers/database.js';

const migrar = async () => {
    try {
        await pool.query(`
            ALTER TABLE clientes
            ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'user'
        `);

        // Restringe los valores posibles a nivel de base de datos
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_rol_check'
                ) THEN
                    ALTER TABLE clientes
                    ADD CONSTRAINT clientes_rol_check CHECK (rol IN ('user', 'admin'));
                END IF;
            END $$;
        `);

        console.log('✅ Migración completada: columna "rol" agregada a "clientes".');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        process.exit(1);
    }
};

migrar();