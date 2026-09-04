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

    function initDragAndDrop(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        let draggedRow = null;

        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('dragstart', function (e) {
                draggedRow = this;
                setTimeout(() => this.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedRow = null;
                updateOrderNumbers(tbodyId);
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
            });

            row.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (this !== draggedRow) {
                    this.classList.add('drag-over');
                }
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
            if (orderCell) {
                orderCell.textContent = String(index + 1).padStart(2, '0');
            }
        });
    }

    // Initialize on load for both tables
    initDragAndDrop('sortable-tbody-main');
    initDragAndDrop('sortable-tbody-sub');
})();