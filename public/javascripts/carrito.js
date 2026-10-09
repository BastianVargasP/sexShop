(function () {
    const formateadorCLP = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    const formatearCLP = (valor) => formateadorCLP.format(Number(valor) || 0);

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
            precioEl.textContent = formatearCLP(totalFila);
            subtotal += totalFila;
        });

        const subtotalEl = document.querySelector('#carritoSubtotal');
        const totalEl = document.querySelector('#carritoTotal');
        if (subtotalEl) subtotalEl.textContent = formatearCLP(subtotal);
        if (totalEl) totalEl.textContent = formatearCLP(subtotal);
    }

    // ---------- Modal de problemas de stock (solo en /carrito) ----------
    const modalStock = document.querySelector('#modalStock');

    function cerrarModalStock() {
        if (!modalStock) return;
        modalStock.classList.add('hidden');
        modalStock.classList.remove('flex');
    }

    function abrirModalStock(problemas) {
        if (!modalStock) return;
        const hayAgotados = problemas.some((p) => p.agotado);
        const hayInsuficientes = problemas.some((p) => !p.agotado);

        const titulo = modalStock.querySelector('#modalStockTitulo');
        const subtitulo = modalStock.querySelector('#modalStockSubtitulo');
        const lista = modalStock.querySelector('#modalStockLista');
        const accion = modalStock.querySelector('#modalStockAccion');

        if (hayInsuficientes) {
            titulo.textContent = 'El pedido supera el stock disponible';
            subtitulo.textContent = hayAgotados
                ? 'Algunos productos tienen menos unidades de las que pediste y otros se agotaron, lo sentimos.'
                : 'Algunos productos tienen menos unidades de las que pediste.';
        } else {
            titulo.textContent = problemas.length > 1
                ? 'Algunos productos están agotados, lo sentimos'
                : 'El producto está agotado, lo sentimos';
            subtitulo.textContent = 'Quítalos del carrito para continuar con tu pedido.';
        }

        lista.replaceChildren();
        problemas.forEach((p) => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center gap-4 bg-surface-container rounded-md px-4 py-3';

            const nombre = document.createElement('span');
            nombre.className = 'font-body-md text-body-md text-on-surface';
            nombre.textContent = p.nombre;

            const detalle = document.createElement('span');
            detalle.className = 'font-label-sm text-label-sm text-error text-right shrink-0';
            detalle.textContent = p.agotado
                ? 'Agotado'
                : `Pediste ${p.solicitado}, quedan ${p.disponible}`;

            li.append(nombre, detalle);
            lista.appendChild(li);
        });

        if (hayInsuficientes) {
            accion.textContent = hayAgotados ? 'Quitar agotados y ajustar cantidades' : 'Ajustar cantidades';
            accion.dataset.ruta = '/carrito/ajustar-cantidades';
        } else {
            accion.textContent = problemas.length > 1 ? 'Quitar productos agotados' : 'Quitar producto agotado';
            accion.dataset.ruta = '/carrito/quitar-agotados';
        }
        accion.disabled = false;

        modalStock.classList.remove('hidden');
        modalStock.classList.add('flex');
        accion.focus();
    }

    if (modalStock) {
        modalStock.addEventListener('click', (evento) => {
            if (evento.target.closest('[data-modal-stock-cerrar]')) cerrarModalStock();
        });
        document.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape') cerrarModalStock();
        });

        modalStock.querySelector('#modalStockAccion').addEventListener('click', async (evento) => {
            const boton = evento.currentTarget;
            boton.disabled = true;
            try {
                const respuesta = await fetch(boton.dataset.ruta, {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin'
                });
                const datos = await respuesta.json().catch(() => null);
                if (!respuesta.ok || !datos || !datos.ok) {
                    mostrarToast('No se pudo actualizar el carrito. Intenta de nuevo.', 'error');
                    boton.disabled = false;
                    return;
                }
                window.location.reload();
            } catch (error) {
                mostrarToast('Ocurrió un error de conexión.', 'error');
                boton.disabled = false;
            }
        });
    }

    // ---------- Enviar el pedido por WhatsApp ----------
    // El servidor crea el pedido y vacía el carrito; si el stock no alcanza responde 409 con el detalle
    // y se muestra el modal en esta misma pestaña (sin abrir nada). Solo si el pedido se crea bien
    // se abre WhatsApp en una pestaña nueva; si el navegador la bloquea, se abre en esta.
    const formPedidoWhatsapp = document.querySelector('#formPedidoWhatsapp');
    if (formPedidoWhatsapp) {
        let enviando = false;

        formPedidoWhatsapp.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            if (enviando) return;
            enviando = true;

            const boton = formPedidoWhatsapp.querySelector('button[type="submit"]');
            if (boton) boton.disabled = true;

            try {
                const respuesta = await fetch(formPedidoWhatsapp.action, {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin'
                });

                if (respuesta.status === 401) {
                    mostrarToast('Tu sesión expiró. Inicia sesión nuevamente.', 'error');
                    enviando = false;
                    if (boton) boton.disabled = false;
                    return;
                }

                const datos = await respuesta.json().catch(() => null);

                if (respuesta.ok && datos && datos.ok) {
                    // Sin 'noopener': con esa opción window.open siempre devuelve null y no se podría detectar el bloqueo
                    const pestanaWhatsapp = window.open(datos.url, '_blank');
                    if (pestanaWhatsapp) {
                        pestanaWhatsapp.opener = null;
                        // El carrito quedó vacío: esta pestaña pasa a "Mis pedidos"
                        window.location.assign('/pedidos');
                    } else {
                        window.location.assign(datos.url); // popup bloqueado: WhatsApp en esta pestaña
                    }
                    return; // no se rehabilita el botón: la página cambia de ruta
                }

                if (respuesta.status === 409 && datos && Array.isArray(datos.problemas)) {
                    abrirModalStock(datos.problemas);
                } else {
                    mostrarToast((datos && datos.error) || 'No se pudo enviar el pedido. Intenta de nuevo.', 'error');
                }
            } catch (error) {
                mostrarToast('Ocurrió un error de conexión.', 'error');
            }

            enviando = false;
            if (boton) boton.disabled = false;
        });
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
                mostrarToast(datos.error || 'No se pudo añadir el producto. Intenta de nuevo.', 'error');
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