const formateadorCLP = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

/**
 * Formatea un número (o string numérico) como precio en pesos chilenos.
 * Ej: formatearCLP(125000) -> "$125.000"
 */
export const formatearCLP = (valor) => {
    const numero = Number(valor) || 0;
    return formateadorCLP.format(numero);
};