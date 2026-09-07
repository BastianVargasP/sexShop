export const generarSlugBase = (texto) =>
    texto
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quita tildes
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-+|-+$)/g, '');

/**
 * Genera un slug único probando sufijos -2, -3, etc. si ya existe.
 * `existeSlug` es una función async (slug) => boolean que consulta la BD.
 */
export const generarSlugUnico = async (nombre, existeSlug) => {
    const base = generarSlugBase(nombre) || 'categoria';
    let slug = base;
    let intento = 2;

    while (await existeSlug(slug)) {
        slug = `${base}-${intento}`;
        intento++;
    }

    return slug;
};