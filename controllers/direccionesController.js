import { pool } from "../helpers/database.js";
import { registrarActividad } from "../helpers/logger.js";

export const listarDirecciones = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM direcciones WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
            [req.session.usuario.id]
        );

        res.render('direcciones', { title: 'Mis direcciones', direcciones: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /direcciones - ERROR: ${error.message}`);
        next(error);
    }
};

export const formularioNuevaDireccion = async (req, res, next) => {
    res.render('nueva-direccion', { title: 'Nueva dirección' });
};

export const nuevaDireccion = async (req, res, next) => {
    try {
        const { etiqueta, address, city, postalCode, province, country, phone, defaultAddress } = req.body;

        if (!address || !city) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'La dirección y la ciudad son obligatorias.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        if (defaultAddress) {
            await pool.query(
                'UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1',
                [req.session.usuario.id]
            );
        }

        await pool.query(
            `INSERT INTO direcciones (cliente_id, etiqueta, direccion, ciudad, codigo_postal, comuna, region, telefono, predeterminada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [req.session.usuario.id, etiqueta || 'Dirección', address, city, postalCode, province, country, phone, !!defaultAddress]
        );

        registrarActividad(`📍 POST /nueva-direccion - ÉXITO: cliente #${req.session.usuario.id}.`);
        res.redirect('/direcciones');
    } catch (error) {
        registrarActividad(`📍❌ POST /nueva-direccion - ERROR: ${error.message}`);
        next(error);
    }
};

export const formularioEditarDireccion = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM direcciones WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return next();
        }

        res.render('editar-direccion', { title: 'Editar dirección', direccion: resultado.rows[0] });
    } catch (error) {
        registrarActividad(`❌ GET /direcciones/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
}

export const editarDireccion = async (req, res, next) => {
    try {
        const { etiqueta, address, city, postalCode, province, country, phone, defaultAddress } = req.body;

        if (!address || !city) {
            return res.status(400).render('error', {
                ok: false,
                mensaje: 'La dirección y la ciudad son obligatorias.',
                error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
            });
        }

        const propietaria = await pool.query(
            'SELECT id FROM direcciones WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietaria.rows.length === 0) {
            return next();
        }

        if (defaultAddress) {
            await pool.query(
                'UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1',
                [req.session.usuario.id]
            );
        }

        await pool.query(
            `UPDATE direcciones
             SET etiqueta = $1, direccion = $2, ciudad = $3, codigo_postal = $4, comuna = $5, region = $6, telefono = $7, predeterminada = $8
             WHERE id = $9 AND cliente_id = $10`,
            [etiqueta || 'Dirección', address, city, postalCode, province, country, phone, !!defaultAddress, req.params.id, req.session.usuario.id]
        );

        registrarActividad(`📍 POST /direcciones/${req.params.id}/editar - ÉXITO.`);
        res.redirect('/direcciones');
    } catch (error) {
        registrarActividad(`📍❌ POST /direcciones/${req.params.id}/editar - ERROR: ${error.message}`);
        next(error);
    }
};

export const eliminarDireccion = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            'DELETE FROM direcciones WHERE id = $1 AND cliente_id = $2 RETURNING id',
            [req.params.id, req.session.usuario.id]
        );

        if (resultado.rows.length === 0) {
            return next();
        }

        registrarActividad(`📍 POST /direcciones/${req.params.id}/eliminar - ÉXITO.`);
        res.redirect('/direcciones');
    } catch (error) {
        registrarActividad(`📍❌ POST /direcciones/${req.params.id}/eliminar - ERROR: ${error.message}`);
        next(error);
    }
};

export const marcarPredeterminada = async (req, res, next) => {
    try {
        const propietaria = await pool.query(
            'SELECT id FROM direcciones WHERE id = $1 AND cliente_id = $2',
            [req.params.id, req.session.usuario.id]
        );
        if (propietaria.rows.length === 0) {
            return next();
        }

        await pool.query('UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
        await pool.query('UPDATE direcciones SET predeterminada = TRUE WHERE id = $1', [req.params.id]);

        registrarActividad(`📍 POST /direcciones/${req.params.id}/predeterminada - ÉXITO.`);
        res.redirect('/direcciones');
    } catch (error) {
        registrarActividad(`📍❌ POST /direcciones/${req.params.id}/predeterminada - ERROR: ${error.message}`);
        next(error);
    }
};