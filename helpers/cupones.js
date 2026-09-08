import { pool } from './database.js';

/**
 * Valida un código de cupón contra el carrito de un cliente específico.
 * Devuelve { ok: true, cupon, descuento, envioGratis } o { ok: false, error }.
 * El descuento siempre viene en CLP, ya calculado (incluye el tope si aplica).
 */
export const validarCupon = async ({ codigo, clienteId, subtotal, envio }) => {
    if (!codigo) {
        return { ok: false, error: 'Ingresa un código de cupón.' };
    }

    const resultado = await pool.query(
        'SELECT * FROM cupones WHERE codigo = $1',
        [codigo.trim().toUpperCase()]
    );

    if (resultado.rows.length === 0) {
        return { ok: false, error: 'Ese cupón no existe.' };
    }

    const cupon = resultado.rows[0];
    const hoy = new Date().toISOString().slice(0, 10);

    if (!cupon.activo) {
        return { ok: false, error: 'Ese cupón ya no está disponible.' };
    }
    if (cupon.fecha_inicio > hoy) {
        return { ok: false, error: 'Ese cupón todavía no está vigente.' };
    }
    if (cupon.fecha_fin && cupon.fecha_fin < hoy) {
        return { ok: false, error: 'Ese cupón ya expiró.' };
    }
    if (Number(subtotal) < Number(cupon.compra_minima)) {
        return { ok: false, error: `Este cupón requiere una compra mínima de ${Number(cupon.compra_minima).toLocaleString('es-CL')} CLP.` };
    }

    if (cupon.limite_usos !== null) {
        const usosResult = await pool.query('SELECT COUNT(*) AS total FROM cupones_usos WHERE cupon_id = $1', [cupon.id]);
        if (Number(usosResult.rows[0].total) >= cupon.limite_usos) {
            return { ok: false, error: 'Ese cupón alcanzó su límite de usos.' };
        }
    }

    if (clienteId) {
        const usosClienteResult = await pool.query(
            'SELECT COUNT(*) AS total FROM cupones_usos WHERE cupon_id = $1 AND cliente_id = $2',
            [cupon.id, clienteId]
        );
        if (Number(usosClienteResult.rows[0].total) >= cupon.limite_por_cliente) {
            return { ok: false, error: 'Ya usaste este cupón el máximo de veces permitido.' };
        }
    }

    let descuento = 0;
    let envioGratis = false;

    if (cupon.tipo === 'porcentaje') {
        descuento = (Number(subtotal) * Number(cupon.valor)) / 100;
        if (cupon.tope_maximo !== null) {
            descuento = Math.min(descuento, Number(cupon.tope_maximo));
        }
    } else if (cupon.tipo === 'monto_fijo') {
        descuento = Math.min(Number(cupon.valor), Number(subtotal));
    } else if (cupon.tipo === 'envio_gratis') {
        descuento = Number(envio) || 0;
        envioGratis = true;
    }

    return { ok: true, cupon, descuento: Math.round(descuento), envioGratis };
};