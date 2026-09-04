<!-- Micro-Interacciones & Lógica de Tabs / Modal -->

let currentMode = 'entrada';
let baseStock = 45;

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

function openModal(defaultType) {
    document.getElementById('modal-stock').classList.remove('hidden');
    if (defaultType === 'Salida manual') setMovementType('salida');
    else if (defaultType === 'Ajuste') setMovementType('ajuste');
    else setMovementType('entrada');
    updateCalculation();
}

function openModalFor(productName, sku, actual, disp) {
    baseStock = actual;
    document.getElementById('modal-product-subtitle').textContent = productName + ' (' + sku + ')';
    document.getElementById('calc-current').textContent = actual + ' uds';
    openModal('Ajuste');
}

function openQuickAdd(sku) {
    baseStock = 10;
    document.getElementById('modal-product-subtitle').textContent = 'Referencia directa: ' + sku;
    document.getElementById('calc-current').textContent = '10 uds';
    openModal('Entrada manual');
}

function closeModal() {
    document.getElementById('modal-stock').classList.add('hidden');
}

function setMovementType(type) {
    currentMode = type;
    const btnIn = document.getElementById('btn-mov-entrada');
    const btnOut = document.getElementById('btn-mov-salida');
    const btnAdj = document.getElementById('btn-mov-ajuste');

    [btnIn, btnOut, btnAdj].forEach(b => {
        b.className = "py-2.5 px-3 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors";
    });

    if (type === 'entrada') {
        btnIn.className = "py-2.5 px-3 rounded-lg bg-secondary text-on-secondary font-semibold font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors";
    } else if (type === 'salida') {
        btnOut.className = "py-2.5 px-3 rounded-lg bg-error-container text-error font-semibold font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors";
    } else {
        btnAdj.className = "py-2.5 px-3 rounded-lg bg-secondary text-on-secondary font-semibold font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors";
    }
    updateCalculation();
}

function updateCalculation() {
    const qtyInput = document.getElementById('input-qty');
    const val = parseInt(qtyInput.value) || 0;
    let projected = baseStock;

    if (currentMode === 'entrada') {
        projected = baseStock + val;
    } else if (currentMode === 'salida') {
        projected = Math.max(0, baseStock - val);
    } else if (currentMode === 'ajuste') {
        projected = val;
    }

    document.getElementById('calc-projected').textContent = projected + ' uds';
}

function confirmMovement() {
    const reason = document.getElementById('input-reason').value.trim();
    if (!reason) {
        alert('Por motivos de trazabilidad estricta de Luxuria Admin, debe ingresar el motivo de esta modificación.');
        return;
    }
    closeModal();
    document.getElementById('input-reason').value = '';
    switchView('movimientos');
}