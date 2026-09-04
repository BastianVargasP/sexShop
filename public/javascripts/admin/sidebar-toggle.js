// Controla la apertura/cierre del sidebar en vistas móviles.
// Se activa solo si existen los elementos correspondientes en la página.
(function () {
    const sidenav = document.getElementById('sidenav') || document.querySelector('nav.fixed.left-0.top-0');
    const openBtn = document.getElementById('admin-open-nav') || document.getElementById('open-nav');
    const closeBtn = document.getElementById('admin-close-nav') || document.getElementById('close-nav');
    const overlay = document.getElementById('nav-overlay');

    if (!sidenav || !openBtn) return;

    function toggleNav() {
        const isClosed = sidenav.classList.contains('-translate-x-full');
        if (isClosed) {
            sidenav.classList.remove('-translate-x-full');
            overlay?.classList.remove('hidden');
            setTimeout(() => overlay?.classList.add('opacity-100'), 10);
        } else {
            sidenav.classList.add('-translate-x-full');
            overlay?.classList.remove('opacity-100');
            setTimeout(() => overlay?.classList.add('hidden'), 300);
        }
    }

    openBtn.addEventListener('click', toggleNav);
    closeBtn?.addEventListener('click', toggleNav);
    overlay?.addEventListener('click', toggleNav);
})();
