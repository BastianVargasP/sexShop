import { pool } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';

// Paso (1-4) al que equivale cada estado del pedido en la línea de tiempo.
const PASOS_POR_ESTADO = { procesando: 2, enviado: 3, entregado: 4, devuelto: 4 };

// Estados que, al ocurrir por primera vez, marcan la fecha de un paso.
// "devuelto" no aparece: no es una etapa con fecha propia en la línea de tiempo.
const PASO_CON_FECHA_POR_ESTADO = { procesando: 2, enviado: 3, entregado: 4 };

/**
 * Arma los datos de la línea de tiempo a partir del historial de estados:
 *  - fechas[1..4]: fecha real de cada etapa (null si el pedido no llegó a ella)
 *  - pasoActual: última etapa alcanzada
 *  - cancelacion: { paso, fecha } si el pedido está cancelado (paso = etapa en que se canceló), o null
 */
const construirLineaDeTiempo = (pedido, historial) => {
    const fechas = { 1: pedido.created_at, 2: null, 3: null, 4: null };
    let pasoActual = 1;
    let cancelacion = null;

    for (const registro of historial) {
        if (registro.estado === 'cancelado') {
            // Solo cuenta el primer registro de cada tramo de cancelación
            if (!cancelacion) cancelacion = { paso: pasoActual, fecha: registro.created_at };
            continue;
        }

        // Si el pedido se reactivó después de cancelarse, deja de estar cancelado
        cancelacion = null;

        const pasoEstado = PASOS_POR_ESTADO[registro.estado];
        if (pasoEstado) pasoActual = pasoEstado;

        const pasoConFecha = PASO_CON_FECHA_POR_ESTADO[registro.estado];
        if (pasoConFecha && !fechas[pasoConFecha]) fechas[pasoConFecha] = registro.created_at;
    }

    // Pedidos antiguos sin historial: el estado "procesando" nace junto con el pedido
    if (historial.length === 0) {
        pasoActual = PASOS_POR_ESTADO[pedido.estado] || 1;
        if (pasoActual >= 2) fechas[2] = pedido.created_at;
        if (pedido.estado === 'cancelado') {
            cancelacion = { paso: 1, fecha: null };
        }
    }

    // Seguridad: el estado actual manda sobre el historial
    if (pedido.estado !== 'cancelado') cancelacion = null;
    else if (!cancelacion) cancelacion = { paso: pasoActual, fecha: null };

    return { fechas, pasoActual: cancelacion ? cancelacion.paso : pasoActual, cancelacion };
};

export const listarPedidos = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT id, numero_pedido, estado, total, created_at
             FROM pedidos WHERE cliente_id = $1 ORDER BY created_at DESC`,
            [req.session.usuario.id]
        );

        res.render('pedidos', { title: 'Mis pedidos', pedidos: resultado.rows });
    } catch (error) {
        registrarActividad(`❌ GET /pedidos - ERROR: ${error.message}`);
        next(error);
    }
};

export const verPedido = async (req, res, next) => {
    try {
        const pedidoResult = await pool.query(
            `SELECT p.*, d.direccion, d.ciudad, d.codigo_postal, d.comuna, d.region,
                    m.marca, m.ultimos_digitos
             FROM pedidos p
                      LEFT JOIN direcciones d ON d.id = p.direccion_id
                      LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
             WHERE p.id = $1 AND p.cliente_id = $2`,
            [req.params.id, req.session.usuario.id]
        );

        if (pedidoResult.rows.length === 0) {
            return next();
        }

        const itemsResult = await pool.query(
            'SELECT * FROM pedido_items WHERE pedido_id = $1',
            [req.params.id]
        );

        const historialResult = await pool.query(
            'SELECT estado, created_at FROM pedidos_historial WHERE pedido_id = $1 ORDER BY created_at ASC, id ASC',
            [req.params.id]
        );

        const pedido = pedidoResult.rows[0];
        const { fechas, pasoActual, cancelacion } = construirLineaDeTiempo(pedido, historialResult.rows);

        res.render('pedido', {
            title: 'Detalle del pedido',
            pedido,
            items: itemsResult.rows,
            pasoActual,
            fechasPasos: fechas,
            cancelacion
        });
    } catch (error) {
        registrarActividad(`❌ GET /pedido/${req.params.id} - ERROR: ${error.message}`);
        next(error);
    }
};