function toggleProductDrawer() {
    const drawer = document.getElementById('productDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (drawer.classList.contains('translate-x-full')) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        }, 10);
    } else {
        overlay.classList.add('opacity-0');
        drawer.classList.add('translate-x-full');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

function abrirDrawerNuevo() {
    const drawer = document.getElementById('productDrawer');
    const overlay = document.getElementById('drawerOverlay');
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-x-full');
    }, 10);
}

/* ==================== Select dependiente: Subcategoría según Categoría ==================== */

function actualizarSubcategorias(categoriaIdSeleccionada, subcategoriaAPreseleccionar) {
    const selectSub = document.getElementById('selectSubcategoria');
    if (!selectSub) return;

    const todas = window.__subcategorias || [];
    const filtradas = todas.filter((s) => String(s.categoriaId) === String(categoriaIdSeleccionada));

    selectSub.innerHTML = '<option value="">Sin subcategoría</option>';
    filtradas.forEach((s) => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.nombre + (s.activa ? '' : ' (inactiva)');
        if (subcategoriaAPreseleccionar && String(subcategoriaAPreseleccionar) === String(s.id)) {
            option.selected = true;
        }
        selectSub.appendChild(option);
    });

    selectSub.disabled = filtradas.length === 0;
}

document.addEventListener('DOMContentLoaded', () => {
    const selectCategoria = document.getElementById('selectCategoria');
    if (!selectCategoria) return;

    // Al abrir en modo edición, dejamos la subcategoría ya guardada precargada
    actualizarSubcategorias(selectCategoria.value, window.__subcategoriaSeleccionada);

    selectCategoria.addEventListener('change', () => {
        actualizarSubcategorias(selectCategoria.value, null);
    });

    // Si la vista viene en modo edición, el overlay debe verse activo también
    const drawer = document.getElementById('productDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer && !drawer.classList.contains('translate-x-full')) {
        overlay.classList.remove('hidden');
        overlay.classList.remove('opacity-0');
    }
});