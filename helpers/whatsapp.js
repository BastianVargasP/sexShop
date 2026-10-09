import { config } from '../config/config.js';
import { formatearCLP } from './formato.js';

const urlWhatsApp = (texto) =>
    `https://wa.me/${config.whatsapp.numero}?text=${encodeURIComponent(texto)}`;

/**
 * Enlace https://wa.me/ con un mensaje de consulta por un producto.
 * Sin argumentos genera un mensaje de consulta general.
 */
export const enlaceWhatsApp = (nombreProducto, precio) => {
    const texto = nombreProducto
        ? `Hola, me interesa el producto "${nombreProducto}"${precio ? ` (${formatearCLP(precio)})` : ''}. ¿Está disponible?`
        : 'Hola, quisiera hacer una consulta sobre sus productos.';

    return urlWhatsApp(texto);
};

/**
 * Enlace https://wa.me/ con el detalle del carrito.
 * items: [{ nombre, precio, cantidad }]
 */
export const enlaceWhatsAppCarrito = (items, nombreCliente, numeroPedido) => {
    const total = items.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
    const lineas = items.map(
        (item) => `• ${item.cantidad} x ${item.nombre} - ${formatearCLP(Number(item.precio) * item.cantidad)}`
    );

    const texto = [
        `Hola, soy ${nombreCliente || 'un cliente'} y quisiera confirmar mi pedido${numeroPedido ? ` #${numeroPedido}` : ''}:`,
        '',
        ...lineas,
        '',
        `Total: ${formatearCLP(total)}`,
        '',
        '¿Me confirman disponibilidad, envío y forma de pago?'
    ].join('\n');

    return urlWhatsApp(texto);
};