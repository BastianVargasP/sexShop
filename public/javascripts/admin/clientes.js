(function () {
    const formatearCLP = (valor) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Number(valor) || 0);

    const ESTADO_BADGE_CLASS = {
        activo: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
        bloqueado: 'bg-error-container/80 text-on-error-container border-error/30',
        inactivo: 'bg-surface-container-highest text-outline border-outline/30'
    };

    function closeClientDrawer() {
        const drawer = document.getElementById('client-drawer');
        const backdrop = document.getElementById('drawer-backdrop');
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('hidden');
        document.body.style.overflow = '';
    }
    window.closeClientDrawer = closeClientDrawer;

    function renderPedidos(pedidos) {
        if (!pedidos || pedidos.length === 0) {
            return '<p class="text-on-surface-variant text-sm text-center py-4">Este cliente aún no tiene pedidos.</p>';
        }
        return `
            <div class="bg-surface-container-low/70 border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table class="w-full text-left text-sm">
                    <thead class="bg-surface-container-high/60 font-label-sm text-[11px] uppercase tracking-wider text-outline border-b border-[#262626]">
                        <tr>
                            <th class="py-2.5 px-4">Pedido</th>
                            <th class="py-2.5 px-3">Fecha</th>
                            <th class="py-2.5 px-3">Estado</th>
                            <th class="py-2.5 px-4 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#262626]/70 font-body-md">
                        ${pedidos.map((p) => `
                            <tr class="hover:bg-surface-container-high/30 transition-colors">
                                <td class="py-3 px-4"><a href="/admin/pedidos?busqueda=${encodeURIComponent(p.numero_pedido)}" class="font-medium text-secondary hover:underline text-sm">#${p.numero_pedido}</a></td>
                                <td class="py-3 px-3 text-on-surface-variant text-xs">${new Date(p.created_at).toLocaleDateString('es-CL')}</td>
                                <td class="py-3 px-3 text-xs text-on-surface">${window.__PEDIDO_ESTADO_LABELS[p.estado] || p.estado}</td>
                                <td class="py-3 px-4 text-right font-medium text-on-surface text-sm">${formatearCLP(p.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    function renderCupones(cupones) {
        if (!cupones || cupones.length === 0) {
            return '<p class="text-on-surface-variant text-sm text-center py-4">Este cliente no ha usado cupones.</p>';
        }
        return `
            <div class="flex flex-wrap gap-2">
                ${cupones.map((c) => `
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-secondary/30 text-secondary">
                        <span class="material-symbols-outlined text-[15px]">confirmation_number</span>
                        <span class="font-mono text-xs font-bold tracking-wider">${c.codigo}</span>
                        <span class="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">×${c.veces_usado}</span>
                    </div>
                `).join('')}
            </div>`;
    }

    function poblarDrawer(datos) {
        const { cliente, direccion, resumen, pedidos, cupones } = datos;
        const iniciales = ((cliente.nombre[0] || '') + (cliente.apellido[0] || '')).toUpperCase();

        document.getElementById('drawer-avatar').textContent = iniciales;
        document.getElementById('drawer-client-name').textContent = `${cliente.nombre} ${cliente.apellido}`;
        document.getElementById('drawer-client-id').textContent = `CLI-${String(cliente.id).padStart(5, '0')}`;

        const badge = document.getElementById('drawer-status-badge');
        badge.className = `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${ESTADO_BADGE_CLASS[cliente.estadoCalculado]}`;
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-current"></span> ${window.__ESTADO_LABELS[cliente.estadoCalculado]}`;

        const direccionHtml = direccion
            ?
            `<div class="flex items-start gap-3">
                <div
                    class="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary shrink-0 mt-0.5">
                    <span class="material-symbols-outlined text-[19px]">home_pin</span>
                </div>
                <div>
                    <span class="font-label-sm text-[11px] text-outline uppercase tracking-wider">Dirección Principal</span>
                    <p class="font-body-md text-base font-semibold text-on-surface">${direccion.direccion}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-[#262626] mt-2">
                <div class="flex flex-col">
                    <span class="font-label-sm text-[10px] text-outline uppercase tracking-wider">Región</span>
                    <span class="font-body-md text-xs sm:text-sm font-medium text-on-surface-variant">${direccion.region}</span>
                </div>
                <div class="flex flex-col">
                    <span class="font-label-sm text-[10px] text-outline uppercase tracking-wider">Ciudad / Comuna</span>
                    <span class="font-body-md text-xs sm:text-sm font-medium text-on-surface-variant">${direccion.ciudad} / ${direccion.comuna}</span>
                </div>
                <div class="flex flex-col">
                    <span class="font-label-sm text-[10px] text-outline uppercase tracking-wider">Código Postal</span>
                    <span class="font-body-md text-xs sm:text-sm font-medium text-secondary">${direccion.codigo_postal}</span>
                </div>
            </div>`
            : '<p class="text-on-surface-variant text-sm">Este cliente no tiene direcciones guardadas.</p>';

        document.getElementById('drawer-content').innerHTML = `
            <section class="space-y-3">
                <div class="flex items-center gap-2 pb-1 border-b border-[#262626]">
                    <span class="material-symbols-outlined text-secondary text-[20px]">person</span>
                    <h3 class="font-headline-md text-base font-semibold text-secondary tracking-wide uppercase text-sm">Información Personal</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-surface-container-low/70 border border-[#2a2a2a] p-4 rounded-xl">
                    <div class="flex flex-col gap-0.5">
                        <span class="font-label-sm text-[11px] text-outline uppercase tracking-wider">Correo Electrónico</span>
                        <span class="font-body-md text-sm text-on-surface flex items-center gap-1.5"><span class="material-symbols-outlined text-outline text-[16px]">mail</span>${cliente.email}</span>
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <span class="font-label-sm text-[11px] text-outline uppercase tracking-wider">Teléfono</span>
                        <span class="font-body-md text-sm text-on-surface flex items-center gap-1.5"><span class="material-symbols-outlined text-outline text-[16px]">call</span>${cliente.telefono || 'No registrado'}</span>
                    </div>
                    <div class="flex flex-col gap-0.5 pt-1 border-t border-[#262626]/80 sm:col-span-2">
                        <span class="font-label-sm text-[11px] text-outline uppercase tracking-wider">Fecha de Registro</span>
                        <span class="font-body-md text-sm text-on-surface flex items-center gap-1.5"><span class="material-symbols-outlined text-secondary text-[16px]">calendar_month</span>${new Date(cliente.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                </div>
            </section>

            <section class="space-y-3">
                <div class="flex items-center gap-2 pb-1 border-b border-[#262626]">
                    <span class="material-symbols-outlined text-secondary text-[20px]">pin_drop</span>
                    <h3 class="font-headline-md text-base font-semibold text-secondary tracking-wide uppercase text-sm">Dirección Principal</h3>
                </div>
                <div class="bg-surface-container-low/70 border border-[#2a2a2a] p-4 rounded-xl">${direccionHtml}</div>
            </section>

            <section class="space-y-3">
                <div class="flex items-center gap-2 pb-1 border-b border-[#262626]">
                    <span class="material-symbols-outlined text-secondary text-[20px]">analytics</span>
                    <h3 class="font-headline-md text-base font-semibold text-secondary tracking-wide uppercase text-sm">Resumen de pedidos</h3>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="bg-surface-container-low/70 border border-[#2a2a2a] p-3.5 rounded-xl flex flex-col justify-between">
                        <span class="font-label-sm text-[11px] uppercase tracking-wider text-outline block mb-1 flex justify-between">Realizados<span class="material-symbols-outlined text-[17px] text-primary">shopping_bag</span></span>
                        <div class="font-headline-md text-2xl font-bold text-on-surface flex flex-col">${resumen.total_pedidos}</div>
                    </div>
                    <div class="bg-surface-container-low/70 border border-secondary/30 p-3.5 rounded-xl flex flex-col justify-between">
                        <span class="font-label-sm text-[11px] uppercase tracking-wider text-secondary block mb-1 flex justify-between">Total Gastado<span class="material-symbols-outlined text-[17px] text-secondary">payments</span></span>
                        <div class="font-headline-md text-xl font-bold text-secondary">${formatearCLP(resumen.total_gastado)}</div>
                    </div>
                    <div class="bg-surface-container-low/70 border border-[#2a2a2a] p-3.5 rounded-xl flex flex-col justify-between">
                        <span class="font-label-sm text-[11px] uppercase tracking-wider text-outline block mb-1 flex justify-between">Pendientes<span class="material-symbols-outlined text-[17px] text-amber-400">pending_actions</span></span>
                        <div class="font-headline-md text-2xl font-bold text-amber-300">${resumen.pendientes}</div>
                    </div>
                    <div class="bg-surface-container-low/70 border border-[#2a2a2a] p-3.5 rounded-xl flex flex-col justify-between">
                        <span class="font-label-sm text-[11px] uppercase tracking-wider text-outline block mb-1 flex justify-between">Cancelados<span class="material-symbols-outlined text-[17px] text-outline">cancel</span></span>
                        <div class="font-headline-md text-2xl font-bold text-on-surface-variant">${resumen.cancelados}</div>
                    </div>
                </div>
            </section>

            <section class="space-y-3">
                <div class="flex items-center gap-2 pb-1 border-b border-[#262626]">
                    <span class="material-symbols-outlined text-secondary text-[20px]">receipt_long</span>
                    <h3 class="font-headline-md text-base font-semibold text-secondary tracking-wide uppercase text-sm">Últimos Pedidos</h3>
                </div>
                ${renderPedidos(pedidos)}
            </section>

            <section class="space-y-3 pb-4">
                <div class="flex items-center gap-2 pb-1 border-b border-[#262626]">
                    <span class="material-symbols-outlined text-secondary text-[20px]">loyalty</span>
                    <h3 class="font-headline-md text-base font-semibold text-secondary tracking-wide uppercase text-sm">Cupones Utilizados</h3>
                </div>
                ${renderCupones(cupones)}
            </section>
        `;

        const bloqueado = cliente.bloqueado;
        document.getElementById('drawer-acciones').innerHTML = `
            <form method="POST" action="/admin/clientes/${cliente.id}/bloquear">
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg border ${bloqueado ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30' : 'border-error/40 text-error hover:bg-error-container/30'} transition-colors font-label-md text-xs uppercase tracking-wider">
                    <span class="material-symbols-outlined text-[16px]">${bloqueado ? 'lock_open' : 'lock'}</span>
                    ${bloqueado ? 'Desbloquear' : 'Bloquear'}
                </button>
            </form>
        `;
    }

    async function abrirClientDrawer(clienteId) {
        const drawer = document.getElementById('client-drawer');
        const backdrop = document.getElementById('drawer-backdrop');

        drawer.classList.remove('translate-x-full');
        backdrop.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        document.getElementById('drawer-content').innerHTML = `
            <div class="flex items-center justify-center py-12 text-on-surface-variant">
                <span class="material-symbols-outlined animate-spin">progress_activity</span>
            </div>`;

        try {
            const respuesta = await fetch(`/admin/clientes/${clienteId}/detalle`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin'
            });
            const datos = await respuesta.json();

            if (!datos.ok) {
                document.getElementById('drawer-content').innerHTML = `<p class="text-error text-sm text-center py-12">${datos.error || 'No se pudo cargar el cliente.'}</p>`;
                return;
            }

            poblarDrawer(datos);
        } catch (error) {
            document.getElementById('drawer-content').innerHTML = '<p class="text-error text-sm text-center py-12">Ocurrió un error de conexión.</p>';
        }
    }

    document.querySelectorAll('[data-abrir-detalle-cliente]').forEach((boton) => {
        boton.addEventListener('click', () => abrirClientDrawer(boton.dataset.abrirDetalleCliente));
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') closeClientDrawer();
    });
})();