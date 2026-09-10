let currentMode = 'entrada';
let baseStock = 0;

function switchView(tab) {
    const vExistencias = document.getElementById('view-existencias');
    const vMovimientos = document.getElementById('view-movimientos');
    const tabEx = document.getElementById('tab-existencias');
    const tabMov = document.getElementById('tab-movimientos');

    if (tab === 'existencias') {
        vExistencias.classList.remove('hidden');
        vMovimientos.classList.add('hidden');
        tabEx.classList.add('bg-surface-container', 'text-secondary', 'shadow-sm');
        tabEx.classList.remove('text-on-surface-variant');
        tabMov.classList.remove('bg-surface-container', 'text-secondary', 'shadow-sm');
        tabMov.classList.add('text-on-surface-variant');
    } else {
        vExistencias.classList.add('hidden');
        vMovimientos.classList.remove('hidden');
        tabMov.classList.add('bg-surface-container', 'text-secondary', 'shadow-sm');
        tabMov.classList.remove('text-on-surface-variant');
        tabEx.classList.remove('bg-surface-container', 'text-secondary', 'shadow-sm');
        tabEx.classList.add('text-on-surface-variant');
    }
}

function openModalFor(productoId, nombre, sku, stockActual, disponible) {
    baseStock = stockActual;
    document.getElementById('input-producto-id').value = productoId;
    document.getElementById('modal-product-subtitle').textContent = `${nombre} (${sku})`;
    document.getElementById('calc-current').textContent = `${stockActual} uds`;
    document.getElementById('input-qty').value = '';
    document.getElementById('input-reason').value = '';
    setMovementType('entrada');
    document.getElementById('modal-stock').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-stock').classList.add('hidden');
}

function setMovementType(type) {
    currentMode = type;
    document.getElementById('input-tipo').value = type;

    const label = document.getElementById('label-qty');
    const qtyInput = document.getElementById('input-qty');
    if (type === 'ajuste') {
        label.textContent = 'Nuevo Stock Total (valor absoluto)';
        qtyInput.min = 0;
    } else {
        label.textContent = 'Cantidad de Unidades';
        qtyInput.min = 1;
    }

    ['entrada', 'salida', 'ajuste'].forEach((t) => {
        const btn = document.getElementById(`btn-mov-${t}`);
        const activo = t === type;
        btn.className = `btn-mov py-2.5 px-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors ${
            activo ? 'bg-secondary text-on-secondary font-semibold' : 'bg-surface-container text-on-surface'
        }`;
    });

    updateCalculation();
}

function updateCalculation() {
    const qtyInput = document.getElementById('input-qty');
    const val = parseInt(qtyInput.value, 10) || 0;
    let projected = baseStock;

    if (currentMode === 'entrada') {
        projected = baseStock + val;
    } else if (currentMode === 'salida') {
        projected = Math.max(0, baseStock - val);
    } else if (currentMode === 'ajuste') {
        projected = val;
    }

    document.getElementById('calc-projected').textContent = `${projected} uds`;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    switchView(params.get('vista') === 'movimientos' ? 'movimientos' : 'existencias');
});