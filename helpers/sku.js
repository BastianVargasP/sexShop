const quitarTildes = (texto) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Genera un SKU legible a partir del nombre de la categoría real
 * (ya no depende de una lista fija de categorías, porque ahora
 * las categorías se crean dinámicamente desde /admin/categorias).
 * Formato: LX-{PREFIJO3}-{timestamp36}-{random3}
 * Ej: LX-JOY-M4X2K1-7F2
 */
export const generarSku = (nombreCategoria) => {
    const limpio = quitarTildes(nombreCategoria || 'PRD').toUpperCase().replace(/[^A-Z]/g, '');
    const prefijo = (limpio.slice(0, 3) || 'PRD').padEnd(3, 'X');
    const timestamp = Date.now().toString(36).toUpperCase();
    const aleatorio = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `LX-${prefijo}-${timestamp}-${aleatorio}`;
};