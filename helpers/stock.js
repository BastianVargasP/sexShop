// Si el producto no define stock_minimo (o es 0), se considera "poco stock" a partir de este umbral.
const UMBRAL_POR_DEFECTO = 5;

/**
 * true si queda stock pero está en o bajo el mínimo del producto.
 * Usa el mismo criterio de "stock_minimo" que el módulo de inventario del admin.
 * Acepta cualquier objeto con { stock, stock_minimo }.
 */
export const pocasUnidades = (producto) => {
    const stock = Number(producto?.stock);
    const minimo = Number(producto?.stock_minimo);
    const umbral = minimo > 0 ? minimo : UMBRAL_POR_DEFECTO;
    return stock > 0 && stock <= umbral;
};