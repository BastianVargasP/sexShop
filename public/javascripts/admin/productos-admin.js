function toggleProductDrawer() {
    const drawer = document.getElementById('productDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (drawer.classList.contains('translate-x-full')) {
        // Open
        overlay.classList.remove('hidden');
        // slight delay to allow display block to apply before opacity transition
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        }, 10);
    } else {
        // Close
        overlay.classList.add('opacity-0');
        drawer.classList.add('translate-x-full');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300); // match duration
    }
}

