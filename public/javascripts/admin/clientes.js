function openClientDrawer(name, email, phone, status) {
    const drawer = document.getElementById('client-drawer');
    const backdrop = document.getElementById('drawer-backdrop');

    if (name) {
        document.getElementById('drawer-client-name').textContent = name;
        document.getElementById('drawer-info-name').textContent = name;

        const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('');
        document.getElementById('drawer-avatar').textContent = initials;
    }
    if (email) {
        document.getElementById('drawer-info-email').innerHTML = '<span class="material-symbols-outlined text-outline text-[16px]">mail</span>' + email;
    }
    if (phone) {
        document.getElementById('drawer-info-phone').innerHTML = '<span class="material-symbols-outlined text-outline text-[16px]">call</span>' + phone;
    }
    if (status) {
        const isBlocked = status.toLowerCase() === 'bloqueado';
        const isInactivo = status.toLowerCase() === 'inactivo';

        let badgeHtml = '';
        if (isBlocked) {
            badgeHtml = '<span class="w-1.5 h-1.5 rounded-full bg-error"></span> Bloqueado';
            document.getElementById('drawer-status-badge').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container/80 text-on-error-container text-[11px] font-medium border border-error/30';
            document.getElementById('drawer-info-status').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container/70 text-on-error-container text-[12px] font-medium border border-error/30';
        } else if (isInactivo) {
            badgeHtml = '<span class="w-1.5 h-1.5 rounded-full bg-outline"></span> Inactivo';
            document.getElementById('drawer-status-badge').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-outline text-[11px] font-medium border border-outline/30';
            document.getElementById('drawer-info-status').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-outline text-[12px] font-medium border border-outline/30';
        } else {
            badgeHtml = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Activo';
            document.getElementById('drawer-status-badge').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 text-[11px] font-medium border border-emerald-500/30';
            document.getElementById('drawer-info-status').className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 text-[12px] font-medium border border-emerald-500/20';
        }
        document.getElementById('drawer-status-badge').innerHTML = badgeHtml;
        document.getElementById('drawer-info-status').innerHTML = badgeHtml;
    }

    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeClientDrawer() {
    const drawer = document.getElementById('client-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
    document.body.style.overflow = '';
}

// Keyboard escape listener to close drawer
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeClientDrawer();
    }
});