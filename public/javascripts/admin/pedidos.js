(function () {
    const ESTADO_CLASSES = {
        procesando: 'bg-secondary/10 text-secondary border-secondary/20',
        enviado: 'bg-primary-container/20 text-primary border-primary/20',
        entregado: 'bg-tertiary-container/40 text-tertiary border-secondary/10',
        devuelto: 'bg-error-container/20 text-error border-error/20',
        cancelado: 'bg-surface-container-highest text-outline border-outline/30'
    };

    const PAGO_CLASSES = {
        pendiente: 'bg-secondary/10 text-secondary border-secondary/20',
        pagado: 'bg-emerald-900/30 text-emerald-400 border-emerald-500/20',
        rechazado: 'bg-error-container/20 text-error border-error/20',
        reembolsado: 'bg-primary-container/20 text-primary border-primary/20'
    };

    const BASE_SELECT_CLASS = 'appearance-none w-full px-2.5 py-1 rounded-full text-xs font-medium tracking-wide focus:ring-0 cursor-pointer border';

    function aplicarClaseSelector(select) {
        const tipo = select.dataset.tipo;
        const mapa = tipo === 'pago' ? PAGO_CLASSES : ESTADO_CLASSES;
        const clases = mapa[select.value] || '';
        select.className = `${BASE_SELECT_CLASS} ${clases}`;
    }

    function mostrarToast(mensaje, tipo) {
        let contenedor = document.querySelector('#admin-toast-container');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'admin-toast-container';
            Object.assign(contenedor.style, {
                position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
                display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end'
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
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)', maxWidth: '320px'
        });

        contenedor.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function actualizarPedidoEnMemoria(pedidoId, tipo, nuevoValor) {
        const pedido = (window.__pedidos || []).find((p) => p.id === pedidoId);
        if (!pedido) return;

        if (tipo === 'pago') {
            pedido.estado_pago = nuevoValor;
        } else {
            const estadoAnterior = pedido.estado;
            pedido.estado = nuevoValor;

            const eraProcesando = estadoAnterior === 'procesando';
            const esProcesando = nuevoValor === 'procesando';

            if (eraProcesando && !esProcesando) {
                actualizarBadgeSidebar(-1);
            } else if (!eraProcesando && esProcesando) {
                actualizarBadgeSidebar(1);
            }
        }

        const actor = window.__usuarioActual || 'Admin';
        pedido.historial = pedido.historial || [];
        pedido.historial.push({
            estado: pedido.estado,
            estado_pago: pedido.estado_pago,
            actor,
            created_at: new Date().toISOString()
        });
    }

    function actualizarBadgeSidebar(delta) {
        const badge = document.getElementById('sidebar-pedidos-badge');
        if (!badge) return;

        const actual = Number(badge.textContent) || 0;
        const nuevo = Math.max(0, actual + delta);

        badge.textContent = nuevo;
        badge.classList.toggle('hidden', nuevo === 0);
    }

    /* ==================== Aplicar estilos iniciales a los selects de la tabla ==================== */

    document.querySelectorAll('.selector-estado').forEach((select) => {
        aplicarClaseSelector(select);

        const valorAnterior = select.value;

        select.addEventListener('change', async () => {
            const pedidoId = Number(select.dataset.pedidoId);
            const tipo = select.dataset.tipo;
            const endpoint = tipo === 'pago' ? `/admin/pedidos/${pedidoId}/pago` : `/admin/pedidos/${pedidoId}/estado`;
            const body = tipo === 'pago' ? { estadoPago: select.value } : { estado: select.value };

            select.disabled = true;
            try {
                const respuesta = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(body)
                });
                const datos = await respuesta.json();

                if (!datos.ok) {
                    select.value = valorAnterior;
                    mostrarToast(datos.error || 'No se pudo actualizar el pedido.', 'error');
                } else {
                    aplicarClaseSelector(select);
                    actualizarPedidoEnMemoria(pedidoId, tipo, select.value);
                    mostrarToast('Pedido actualizado correctamente.', 'success');
                }
            } catch (error) {
                select.value = valorAnterior;
                mostrarToast('Ocurrió un error de conexión.', 'error');
            } finally {
                select.disabled = false;
            }
        });
    });

    /* ==================== Modal de detalle ==================== */

    const modal = document.getElementById('order-modal');
    if (!modal) return;

    const formatearCLP = (valor) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Number(valor) || 0);

    function poblarModal(pedido) {
        document.getElementById('modal-numero-pedido').textContent = `#${pedido.numero_pedido}`;
        document.getElementById('modal-fecha-pedido').textContent = new Date(pedido.created_at).toLocaleString('es-CL');

        document.getElementById('modal-cliente-nombre').textContent = `${pedido.cliente_nombre} ${pedido.cliente_apellido}`;
        document.getElementById('modal-cliente-email').textContent = pedido.cliente_email || '';
        document.getElementById('modal-cliente-telefono').textContent = pedido.cliente_telefono || '';

        const direccionEl = document.getElementById('modal-direccion');
        direccionEl.textContent = pedido.direccion
            ? `${pedido.direccion}, ${pedido.ciudad || ''}${pedido.comuna ? ', ' + pedido.comuna : ''}${pedido.region ? ', ' + pedido.region : ''}`
            : 'Sin dirección registrada.';

        const itemsBody = document.getElementById('modal-items');
        itemsBody.innerHTML = (pedido.items || []).map((item) => `
            <tr>
                <td class="px-4 py-3 text-on-surface">${item.producto_nombre}</td>
                <td class="px-4 py-3 text-on-surface text-center">${item.cantidad}</td>
                <td class="px-4 py-3 text-on-surface text-right">${formatearCLP(item.precio_unitario)}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="px-4 py-3 text-on-surface-variant text-center">Sin ítems registrados.</td></tr>';

        const metodoPagoEl = document.getElementById('modal-metodo-pago');
        metodoPagoEl.textContent = pedido.marca
            ? `${pedido.marca} terminada en ${pedido.ultimos_digitos}`
            : 'Sin método de pago asociado.';

        document.getElementById('modal-resumen').innerHTML = `
            <div class="flex justify-between text-sm"><span class="text-on-surface-variant">Subtotal:</span><span class="text-on-surface">${formatearCLP(pedido.subtotal)}</span></div>
            <div class="flex justify-between text-sm"><span class="text-on-surface-variant">Envío:</span><span class="text-on-surface">${formatearCLP(pedido.envio)}</span></div>
            <div class="flex justify-between text-lg font-semibold pt-2 border-t border-secondary/10"><span class="text-secondary">Total Final:</span><span class="text-secondary">${formatearCLP(pedido.total)}</span></div>
        `;

        const historialEl = document.getElementById('modal-historial');
        const historial = pedido.historial || [];
        historialEl.innerHTML = historial.length === 0
            ? '<p class="text-on-surface-variant text-sm pl-8">Sin eventos registrados todavía.</p>'
            : historial.slice().reverse().map((h, index) => `
                <div class="relative pl-8">
                    <div class="absolute left-0 top-1.5 w-6 h-6 rounded-full ${index === 0 ? 'bg-secondary' : 'bg-surface-container-highest border border-secondary/30'} flex items-center justify-center">
                        ${index === 0 ? '<span class="material-symbols-outlined text-[14px] text-on-primary">check</span>' : '<span class="w-2 h-2 rounded-full bg-secondary/50"></span>'}
                    </div>
                    <p class="text-on-surface font-medium text-sm">${window.__ESTADO_LABELS[h.estado] || h.estado} · ${window.__PAGO_LABELS[h.estado_pago] || h.estado_pago}</p>
                    <p class="text-on-surface-variant text-xs">${new Date(h.created_at).toLocaleString('es-CL')} - Por: ${h.actor || 'Sistema'}</p>
                </div>
            `).join('');
    }

    document.querySelectorAll('[data-abrir-detalle-pedido]').forEach((boton) => {
        boton.addEventListener('click', () => {
            const pedidoId = Number(boton.dataset.abrirDetallePedido);
            const pedido = (window.__pedidos || []).find((p) => p.id === pedidoId);
            if (!pedido) return;

            poblarModal(pedido);
            modal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('[data-cerrar-detalle-pedido]').forEach((el) => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') modal.classList.add('hidden');
    });
})();