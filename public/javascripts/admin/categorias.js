(function () {
    const tabMain = document.getElementById('tab-main');
    const tabSub = document.getElementById('tab-sub');
    const wrapperMain = document.getElementById('table-main-wrapper');
    const wrapperSub = document.getElementById('table-sub-wrapper');

    function setActive(activeTab, inactiveTab, isMain) {
        activeTab.classList.add('text-secondary', 'border-b-2', 'border-secondary');
        activeTab.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
        inactiveTab.classList.remove('text-secondary', 'border-b-2', 'border-secondary');
        inactiveTab.classList.add('text-on-surface-variant', 'hover:text-on-surface');

        if (isMain) {
            wrapperMain.classList.remove('hidden');
            wrapperSub.classList.add('hidden');
        } else {
            wrapperMain.classList.add('hidden');
            wrapperSub.classList.remove('hidden');
        }
    }

    tabMain.addEventListener('click', () => setActive(tabMain, tabSub, true));
    tabSub.addEventListener('click', () => setActive(tabSub, tabMain, false));

    /* ==================== Drag & drop con persistencia ==================== */

    function initDragAndDrop(tbodyId, endpoint) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        let draggedRow = null;

        function guardarOrden() {
            const ids = Array.from(tbody.querySelectorAll('tr[data-id]')).map((row) => Number(row.dataset.id));
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ ids })
            }).catch(() => {
                // si falla el guardado, no rompemos la UI; el usuario puede recargar
            });
        }

        tbody.querySelectorAll('tr').forEach((row) => {
            row.addEventListener('dragstart', function (e) {
                draggedRow = this;
                setTimeout(() => this.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedRow = null;
                updateOrderNumbers(tbodyId);
                tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
                guardarOrden();
            });

            row.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (this !== draggedRow) this.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            });

            row.addEventListener('dragleave', function () {
                this.classList.remove('drag-over');
            });

            row.addEventListener('drop', function (e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                if (this !== draggedRow) {
                    const allRows = Array.from(tbody.querySelectorAll('tr'));
                    const draggedIndex = allRows.indexOf(draggedRow);
                    const droppedIndex = allRows.indexOf(this);

                    if (draggedIndex < droppedIndex) {
                        this.parentNode.insertBefore(draggedRow, this.nextSibling);
                    } else {
                        this.parentNode.insertBefore(draggedRow, this);
                    }
                }
            });
        });
    }

    function updateOrderNumbers(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const orderCell = row.querySelector('.order-cell');
            if (orderCell) orderCell.textContent = String(index + 1).padStart(2, '0');
        });
    }

    initDragAndDrop('sortable-tbody-main', '/admin/categorias/orden');
    initDragAndDrop('sortable-tbody-sub', '/admin/subcategorias/orden');

    /* ==================== Modal crear/editar ==================== */

    window.openCategoryModal = function (opciones) {
        const modal = document.getElementById('categoryModal');
        const form = document.getElementById('categoryForm');
        const title = document.getElementById('categoryModalTitle');
        const parentField = document.getElementById('categoryParentField');
        const descField = document.getElementById('categoryDescField');

        form.action = opciones.action;
        title.textContent = opciones.title;

        document.getElementById('categoryNombre').value = opciones.nombre || '';
        document.getElementById('categoryImagen').value = opciones.imagen || '';
        document.getElementById('categoryActiva').checked = opciones.activa !== false;

        if (opciones.esSubcategoria) {
            parentField.classList.remove('hidden');
            descField.classList.add('hidden');
            document.getElementById('categoryParentSelect').value = opciones.categoriaId || '';
        } else {
            parentField.classList.add('hidden');
            descField.classList.remove('hidden');
            document.getElementById('categoryDescripcion').value = opciones.descripcion || '';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.closeCategoryModal = function () {
        const modal = document.getElementById('categoryModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // Si veníamos de una URL de edición, volvemos al listado limpio al cancelar
        if (window.__editarCategoria || window.__editarSubcategoria) {
            window.location.href = '/admin/categorias';
        }
    };

    window.openCreateCategoryModal = function () {
        openCategoryModal({
            action: '/admin/categorias',
            title: 'Nueva Categoría',
            esSubcategoria: false
        });
    };

    window.openCreateSubcategoryModal = function () {
        openCategoryModal({
            action: '/admin/subcategorias',
            title: 'Nueva Subcategoría',
            esSubcategoria: true
        });
    };

    // Si la vista se cargó en modo edición (vino de /admin/categorias/:id/editar
    // o /admin/subcategorias/:id/editar), abrir el modal ya precargado.
    document.addEventListener('DOMContentLoaded', () => {
        if (window.__editarCategoria) {
            const c = window.__editarCategoria;
            openCategoryModal({
                action: `/admin/categorias/${c.id}/editar`,
                title: 'Editar Categoría',
                esSubcategoria: false,
                nombre: c.nombre,
                descripcion: c.descripcion,
                imagen: c.imagen,
                activa: c.activa
            });
        }
        if (window.__editarSubcategoria) {
            const s = window.__editarSubcategoria;
            setActive(tabSub, tabMain, false);
            openCategoryModal({
                action: `/admin/subcategorias/${s.id}/editar`,
                title: 'Editar Subcategoría',
                esSubcategoria: true,
                nombre: s.nombre,
                categoriaId: s.categoriaId,
                imagen: s.imagen,
                activa: s.activa
            });
        }
    });
})();