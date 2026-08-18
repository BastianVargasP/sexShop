(function () {
    function actualizarBotonFavorito(boton, esFavorito) {
        boton.dataset.favorito = esFavorito ? 'true' : 'false';
        const icono = boton.querySelector('.material-symbols-outlined');
        if (icono) {
            icono.style.setProperty('font-variation-settings', `'FILL' ${esFavorito ? 1 : 0}`);
        }
        boton.classList.toggle('text-secondary', esFavorito);
        boton.classList.toggle('text-on-surface-variant', !esFavorito);
        boton.title = esFavorito ? 'Quitar de favoritos' : 'Añadir a favoritos';
    }

    function mostrarToast(mensaje, tipo) {
        let contenedor = document.querySelector('#toast-container');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'toast-container';
            Object.assign(contenedor.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: '9999',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-end',
                pointerEvents: 'none'
            });
            document.body.appendChild(contenedor);
        }

        const toast = document.createElement('div');
        toast.textContent = mensaje;
        Object.assign(toast.style, {
            background: tipo === 'error' ? '#3a1414' : '#201f1f',
            border: `1px solid ${tipo === 'error' ? 'rgba(255,90,90,0.4)' : 'rgba(233,195,73,0.4)'}`,
            color: tipo === 'error' ? '#ffb4ab' : '#e9c349',
            padding: '12px 20px',
            borderRadius: '8px',
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: '14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            opacity: '0',
            transform: 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            maxWidth: '280px'
        });

        contenedor.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, 2500);
    }

    document.addEventListener('click', async (evento) => {
        const boton = evento.target.closest('[data-favorito-toggle]');
        if (!boton) return;
        evento.preventDefault();
        if (boton.disabled) return;

        const productoId = boton.dataset.productoId;
        const esFavoritoActual = boton.dataset.favorito === 'true';
        const url = `/productos/${productoId}/${esFavoritoActual ? 'quitar-favorito' : 'favorito'}`;

        boton.disabled = true;
        try {
            const respuesta = await fetch(url, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin'
            });

            if (respuesta.status === 401) {
                mostrarToast('Inicia sesión para guardar tus favoritos.', 'error');
                return;
            }

            const datos = await respuesta.json();
            if (!datos.ok) {
                mostrarToast('No se pudo actualizar tus favoritos. Intenta de nuevo.', 'error');
                return;
            }

            const nuevoEstado = datos.favorito;
            actualizarBotonFavorito(boton, nuevoEstado);
            mostrarToast(nuevoEstado ? 'Añadido a tu lista de deseos' : 'Eliminado de tu lista de deseos', 'success');

            // En la página de favoritos, al quitar un producto se anima y se elimina la tarjeta completa
            if (!nuevoEstado && boton.dataset.eliminarTarjetaAlQuitar === 'true') {
                const tarjeta = boton.closest('.producto-card');
                if (tarjeta) {
                    tarjeta.style.transition = 'opacity 0.3s ease';
                    tarjeta.style.opacity = '0';
                    setTimeout(() => {
                        tarjeta.remove();
                        const grid = document.querySelector('#gridFavoritos');
                        const estadoVacio = document.querySelector('#estadoVacioFavoritos');
                        if (grid && estadoVacio && grid.querySelectorAll('.producto-card').length === 0) {
                            grid.style.display = 'none';
                            estadoVacio.style.display = '';
                        }
                        const contador = document.querySelector('#contadorFavoritos');
                        if (contador && grid) {
                            const restantes = grid.querySelectorAll('.producto-card').length;
                            contador.textContent = `${restantes} Artículo${restantes !== 1 ? 's' : ''}`;
                        }
                    }, 300);
                }
            }
        } catch (error) {
            mostrarToast('Ocurrió un error de conexión.', 'error');
        } finally {
            boton.disabled = false;
        }
    });
})();
