<!-- Tab Switching Script -->

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('border-secondary', 'text-secondary', 'bg-secondary/10');
        el.classList.add('border-transparent', 'text-on-surface-variant');
    });
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.remove('hidden');
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-on-surface-variant');
        activeBtn.classList.add('border-secondary', 'text-secondary', 'bg-secondary/10');
    }
}

function toggleVisibility(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
        el.type = el.type === 'password' ? 'text' : 'password';
    }
}

function saveAllConfig() {
    const toast = document.getElementById('save-toast');
    if (toast) {
        toast.classList.remove('translate-y-24', 'opacity-0');
        setTimeout(() => {
            toast.classList.add('translate-y-24', 'opacity-0');
        }, 3500);
    }
}

function discardChanges() {
    alert('Cambios descartados. Se han restaurado los valores anteriores.');
}