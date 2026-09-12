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

function abrirModalNuevaCategoria() {
    document.getElementById('inputNuevaCategoriaNombre').value = '';
    document.getElementById('errorNuevaCategoria').classList.add('hidden');
    const modal = document.getElementById('modalNuevaCategoria');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function cerrarModalNuevaCategoria() {
    const modal = document.getElementById('modalNuevaCategoria');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function guardarNuevaCategoria() {
    const nombre = document.getElementById('inputNuevaCategoriaNombre').value.trim();
    const errorEl = document.getElementById('errorNuevaCategoria');
    errorEl.classList.add('hidden');

    if (!nombre) {
        errorEl.textContent = 'El nombre es obligatorio.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const respuesta = await fetch('/admin/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ nombre, activa: true })
        });
        const datos = await respuesta.json();

        if (!datos.ok) {
            errorEl.textContent = datos.error || 'No se pudo crear la categoría.';
            errorEl.classList.remove('hidden');
            return;
        }

        const selectCategoria = document.getElementById('selectCategoria');
        const option = document.createElement('option');
        option.value = datos.categoria.id;
        option.textContent = datos.categoria.nombre;
        option.selected = true;
        selectCategoria.appendChild(option);
        selectCategoria.value = datos.categoria.id;
        actualizarSubcategorias(datos.categoria.id, null);

        cerrarModalNuevaCategoria();
    } catch (error) {
        errorEl.textContent = 'Ocurrió un error de conexión.';
        errorEl.classList.remove('hidden');
    }
}

function abrirModalNuevaSubcategoria() {
    const selectCategoria = document.getElementById('selectCategoria');
    if (!selectCategoria.value) {
        alert('Primero selecciona una categoría.');
        return;
    }
    document.getElementById('nuevaSubcategoriaCategoriaNombre').textContent =
        selectCategoria.options[selectCategoria.selectedIndex].textContent;
    document.getElementById('inputNuevaSubcategoriaNombre').value = '';
    document.getElementById('errorNuevaSubcategoria').classList.add('hidden');
    const modal = document.getElementById('modalNuevaSubcategoria');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function cerrarModalNuevaSubcategoria() {
    const modal = document.getElementById('modalNuevaSubcategoria');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function guardarNuevaSubcategoria() {
    const categoriaId = document.getElementById('selectCategoria').value;
    const nombre = document.getElementById('inputNuevaSubcategoriaNombre').value.trim();
    const errorEl = document.getElementById('errorNuevaSubcategoria');
    errorEl.classList.add('hidden');

    if (!nombre) {
        errorEl.textContent = 'El nombre es obligatorio.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const respuesta = await fetch('/admin/subcategorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ nombre, categoriaId, activa: true })
        });
        const datos = await respuesta.json();

        if (!datos.ok) {
            errorEl.textContent = datos.error || 'No se pudo crear la subcategoría.';
            errorEl.classList.remove('hidden');
            return;
        }

        window.__subcategorias = window.__subcategorias || [];
        window.__subcategorias.push({
            id: datos.subcategoria.id,
            nombre: datos.subcategoria.nombre,
            categoriaId: datos.subcategoria.categoria_id,
            activa: datos.subcategoria.activa
        });

        actualizarSubcategorias(categoriaId, datos.subcategoria.id);
        cerrarModalNuevaSubcategoria();
    } catch (error) {
        errorEl.textContent = 'Ocurrió un error de conexión.';
        errorEl.classList.remove('hidden');
    }
}