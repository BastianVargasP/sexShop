(function () {
    const formatearCLP = (valor) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Number(valor) || 0);

    const btnAplicar = document.getElementById('btnAplicarCupon');
    const btnQuitar = document.getElementById('btnQuitarCupon');
    const inputCupon = document.getElementById('inputCupon');
    const errorEl = document.getElementById('errorCupon');

    if (btnAplicar) {
        btnAplicar.addEventListener('click', async () => {
            const codigo = inputCupon.value.trim();
            if (!codigo) return;

            btnAplicar.disabled = true;
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const respuesta = await fetch('/checkout/cupon', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ codigo })
                });
                const datos = await respuesta.json();

                if (!datos.ok) {
                    if (errorEl) {
                        errorEl.textContent = datos.error;
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                // Recargamos para reflejar el estado del cupón aplicado de forma consistente
                window.location.reload();
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = 'Ocurrió un error de conexión.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                btnAplicar.disabled = false;
            }
        });
    }

    if (btnQuitar) {
        btnQuitar.addEventListener('click', async () => {
            btnQuitar.disabled = true;
            try {
                await fetch('/checkout/cupon/quitar', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                window.location.reload();
            } catch (error) {
                btnQuitar.disabled = false;
            }
        });
    }
})();