(function () {
    function mostrarToast(mensaje, tipo) {
        let contenedor = document.querySelector('#toast-container');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'toast-container';
            Object.assign(contenedor.style, {
                position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
                display: 'flex', flexDirection: 'column', gap: '8px',
                alignItems: 'flex-end', pointerEvents: 'none'
            });
            document.body.appendChild(contenedor);
        }

        const toast = document.createElement('div');
        toast.textContent = mensaje;
        Object.assign(toast.style, {
            background: tipo === 'error' ? '#3a1414' : '#201f1f',
            border: `1px solid ${tipo === 'error' ? 'rgba(255,90,90,0.4)' : 'rgba(233,195,73,0.4)'}`,
            color: tipo === 'error' ? '#ffb4ab' : '#e9c349',
            padding: '12px 20px', borderRadius: '8px',
            fontFamily: "'Hanken Grotesk', sans-serif", fontSize: '14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            opacity: '0', transform: 'translateY(10px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            maxWidth: '280px', pointerEvents: 'auto',
            cursor: tipo === 'error' ? 'pointer' : 'default'
        });

        if (tipo === 'error') {
            toast.title = 'Ir a iniciar sesión';
            toast.addEventListener('click', () => { window.location.href = '/auth/login'; });
        }

        contenedor.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }

    function actualizarBadge(cantidad) {
        const badge = document.querySelector('#carritoContador');
        if (badge) badge.textContent = cantidad;
    }

    function recalcularTotales() {
        let subtotal = 0;
        document.querySelectorAll('[data-carrito-item]').forEach((fila) => {
            const cantidad = Number(fila.querySelector('[data-carrito-cantidad]').textContent);
            const precioEl = fila.querySelector('[data-carrito-precio-unitario]');
            const precioUnitario = Number(precioEl.dataset.carritoPrecioUnitario);
            const totalFila = precioUnitario * cantidad;
            precioEl.textContent = `${totalFila.toFixed(2)}€`;
            subtotal += totalFila;
        });

        const subtotalEl = document.querySelector('#carritoSubtotal');
        const totalEl = document.querySelector('#carritoTotal');
        if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(2)}€`;
        if (totalEl) totalEl.textContent = `${subtotal.toFixed(2)}€`;
    }

    // Añadir al carrito (botones en /productos y /producto/:id)
    document.addEventListener('click', async (evento) => {
        const boton = evento.target.closest('[data-add-carrito]');
        if (!boton) return;
        evento.preventDefault();
        if (boton.disabled) return;

        if (!window.usuarioLogueado) {
            mostrarToast('Debes iniciar sesión para añadir productos al carrito.', 'error');
            return;
        }

        const productoId = boton.dataset.productoId;
        boton.disabled = true;
        try {
            const respuesta = await fetch(`/productos/${productoId}/carrito`, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin'
            });

            if (respuesta.status === 401) {
                mostrarToast('Debes iniciar sesión para añadir productos al carrito.', 'error');
                return;
            }

            const datos = await respuesta.json();
            if (!datos.ok) {
                mostrarToast('No se pudo añadir el producto. Intenta de nuevo.', 'error');
                return;
            }

            actualizarBadge(datos.cantidadCarrito);
            mostrarToast('Producto añadido al carrito', 'success');
        } catch (error) {
            mostrarToast('Ocurrió un error de conexión.', 'error');
        } finally {
            boton.disabled = false;
        }
    });

    // Incrementar / decrementar / eliminar (solo en /carrito)
    document.addEventListener('click', async (evento) => {
        const boton = evento.target.closest('[data-carrito-accion]');
        if (!boton) return;
        evento.preventDefault();
        if (boton.disabled) return;

        const accion = boton.dataset.carritoAccion;
        const itemId = boton.dataset.carritoItemId;
        const fila = document.querySelector(`[data-carrito-item="${itemId}"]`);

        boton.disabled = true;
        try {
            const respuesta = await fetch(`/carrito/${itemId}/${accion}`, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin'
            });

            if (respuesta.status === 401) {
                mostrarToast('Tu sesión expiró. Inicia sesión nuevamente.', 'error');
                return;
            }

            const datos = await respuesta.json();
            if (!datos.ok) {
                mostrarToast('No se pudo actualizar el carrito. Intenta de nuevo.', 'error');
                return;
            }

            if (accion === 'eliminar' || datos.eliminado) {
                if (fila) fila.remove();
            } else if (fila) {
                fila.querySelector('[data-carrito-cantidad]').textContent = datos.cantidad;
            }

            recalcularTotales();

            const restantes = document.querySelectorAll('[data-carrito-item]').length;
            if (restantes === 0) {
                setTimeout(() => window.location.reload(), 300);
            }
        } catch (error) {
            mostrarToast('Ocurrió un error de conexión.', 'error');
        } finally {
            boton.disabled = false;
        }
    });
})();