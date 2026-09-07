document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('#gridProductos');
    const estadoVacio = document.querySelector('#estadoVacio');
    const contador = document.querySelector('#contadorProductos');
    const selectOrden = document.querySelector('#ordenSelect');
    const checkboxesCategoria = document.querySelectorAll('input[name="categoria"]');
    const checkboxesSubcategoria = document.querySelectorAll('input[name="subcategoria"]');
    const btnLimpiar = document.querySelector('#limpiarFiltro');

    if (!grid) return; // por si esta vista no está cargada

    function actualizarEstiloCheckbox(checkbox) {
        const label = checkbox.closest('label')?.querySelector('span');
        if (!label) return;
        label.classList.toggle('text-secondary', checkbox.checked);
        label.classList.toggle('text-on-surface-variant', !checkbox.checked);
    }

    function compararProductos(a, b, orden) {
        const precioA = parseFloat(a.dataset.precio);
        const precioB = parseFloat(b.dataset.precio);
        const creadoA = Number(a.dataset.creado);
        const creadoB = Number(b.dataset.creado);
        const destacadoA = a.dataset.destacado === '1' ? 1 : 0;
        const destacadoB = b.dataset.destacado === '1' ? 1 : 0;

        switch (orden) {
            case 'precio-asc':
                return precioA - precioB;
            case 'precio-desc':
                return precioB - precioA;
            case 'novedades':
                return creadoB - creadoA;
            default: // recomendados
                if (destacadoB !== destacadoA) return destacadoB - destacadoA;
                return creadoB - creadoA;
        }
    }

    function aplicarFiltros() {
        const categoriasSeleccionadas = Array.from(checkboxesCategoria)
            .filter((cb) => cb.checked)
            .map((cb) => cb.value);

        // Agrupamos las subcategorías marcadas por su categoría padre
        const subsPorCategoria = {};
        Array.from(checkboxesSubcategoria)
            .filter((cb) => cb.checked)
            .forEach((cb) => {
                const categoriaPadre = cb.dataset.categoriaPadre;
                if (!subsPorCategoria[categoriaPadre]) subsPorCategoria[categoriaPadre] = [];
                subsPorCategoria[categoriaPadre].push(cb.value);
            });

        const orden = selectOrden ? selectOrden.value : 'recomendados';
        const tarjetas = Array.from(grid.querySelectorAll('.producto-card'));

        function productoCoincide(tarjeta) {
            // Sin ninguna categoría marcada: se muestra todo
            if (categoriasSeleccionadas.length === 0) return true;

            // El producto debe pertenecer a alguna de las categorías marcadas
            if (!categoriasSeleccionadas.includes(tarjeta.dataset.categoria)) return false;

            const subsMarcadasDeSuCategoria = subsPorCategoria[tarjeta.dataset.categoria];

            // Si en esa categoría no se marcó ninguna subcategoría específica, cualquier producto de la categoría vale
            if (!subsMarcadasDeSuCategoria || subsMarcadasDeSuCategoria.length === 0) return true;

            // Si sí se marcaron subcategorías específicas, el producto debe estar en alguna de ellas
            return subsMarcadasDeSuCategoria.includes(tarjeta.dataset.subcategoria);
        }

        let visibles = 0;
        tarjetas.forEach((tarjeta) => {
            const coincide = productoCoincide(tarjeta);
            tarjeta.style.display = coincide ? '' : 'none';
            if (coincide) visibles += 1;
        });

        tarjetas
            .filter((t) => t.style.display !== 'none')
            .sort((a, b) => compararProductos(a, b, orden))
            .forEach((t) => grid.appendChild(t));

        if (contador) {
            contador.textContent = `${visibles} producto${visibles !== 1 ? 's' : ''} encontrado${visibles !== 1 ? 's' : ''}`;
        }

        if (estadoVacio) {
            estadoVacio.style.display = visibles === 0 ? '' : 'none';
        }
        grid.style.display = visibles === 0 ? 'none' : 'grid';
    }

    /* ==================== Categoría: filtra + despliega sus subcategorías ==================== */

    checkboxesCategoria.forEach((cb) => {
        cb.addEventListener('change', () => {
            actualizarEstiloCheckbox(cb);

            // Al marcar una categoría, mostramos automáticamente sus subcategorías
            const listaSubs = document.querySelector(`[data-subcategorias-de="${cb.value}"]`);
            if (cb.checked && listaSubs) {
                listaSubs.classList.remove('hidden');
                const chevron = document.querySelector(`[data-chevron="${cb.value}"]`);
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            }

            // Al desmarcar una categoría, desmarcamos también sus subcategorías (para evitar filtros contradictorios)
            if (!cb.checked && listaSubs) {
                listaSubs.querySelectorAll('input[name="subcategoria"]').forEach((subCb) => {
                    subCb.checked = false;
                    actualizarEstiloCheckbox(subCb);
                });
            }

            aplicarFiltros();
        });
    });

    /* ==================== Subcategoría: al marcarla, aseguramos que su categoría padre también quede marcada ==================== */

    checkboxesSubcategoria.forEach((cb) => {
        cb.addEventListener('change', () => {
            actualizarEstiloCheckbox(cb);

            if (cb.checked) {
                const categoriaPadreId = cb.dataset.categoriaPadre;
                const checkboxPadre = document.querySelector(`input[name="categoria"][value="${categoriaPadreId}"]`);
                if (checkboxPadre && !checkboxPadre.checked) {
                    checkboxPadre.checked = true;
                    actualizarEstiloCheckbox(checkboxPadre);
                }
            }

            aplicarFiltros();
        });
    });

    /* ==================== Botón para expandir/colapsar subcategorías manualmente ==================== */

    document.querySelectorAll('[data-toggle-subcategorias]').forEach((boton) => {
        boton.addEventListener('click', () => {
            const categoriaId = boton.dataset.toggleSubcategorias;
            const listaSubs = document.querySelector(`[data-subcategorias-de="${categoriaId}"]`);
            const chevron = document.querySelector(`[data-chevron="${categoriaId}"]`);
            if (!listaSubs) return;

            const estaOculto = listaSubs.classList.contains('hidden');
            listaSubs.classList.toggle('hidden', !estaOculto);
            if (chevron) chevron.style.transform = estaOculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    });

    if (selectOrden) {
        selectOrden.addEventListener('change', aplicarFiltros);
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            checkboxesCategoria.forEach((cb) => {
                cb.checked = false;
                actualizarEstiloCheckbox(cb);
            });
            checkboxesSubcategoria.forEach((cb) => {
                cb.checked = false;
                actualizarEstiloCheckbox(cb);
            });
            document.querySelectorAll('[data-subcategorias-de]').forEach((lista) => lista.classList.add('hidden'));
            document.querySelectorAll('[data-chevron]').forEach((chevron) => { chevron.style.transform = 'rotate(0deg)'; });
            aplicarFiltros();
        });
    }

    aplicarFiltros();
});