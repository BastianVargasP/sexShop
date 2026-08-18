document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('#gridProductos');
    const estadoVacio = document.querySelector('#estadoVacio');
    const contador = document.querySelector('#contadorProductos');
    const selectOrden = document.querySelector('#ordenSelect');
    const checkboxesCategoria = document.querySelectorAll('input[name="categoria"]');
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

        const orden = selectOrden ? selectOrden.value : 'recomendados';
        const tarjetas = Array.from(grid.querySelectorAll('.producto-card'));

        let visibles = 0;
        tarjetas.forEach((tarjeta) => {
            const coincide = categoriasSeleccionadas.length === 0 || categoriasSeleccionadas.includes(tarjeta.dataset.categoria);
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

    checkboxesCategoria.forEach((cb) => {
        cb.addEventListener('change', () => {
            actualizarEstiloCheckbox(cb);
            aplicarFiltros();
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
            aplicarFiltros();
        });
    }

    aplicarFiltros();
});
