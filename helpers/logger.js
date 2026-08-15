import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';

const LOG_PATH = path.join(process.cwd(), 'logs', 'activity.log');

export const registrarActividad = (mensaje) => {
    try {
        const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const logEntry = `[${timestamp}] ${mensaje}\n`;

        fs.appendFileSync(LOG_PATH, logEntry, "utf8");

    } catch (error) {
        console.error("Error crítico en el sistema de logs:", error.message);
    }
}