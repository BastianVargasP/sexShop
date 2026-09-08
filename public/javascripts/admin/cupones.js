(function () {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    const title = document.getElementById('couponModalTitle');

    const campoCodigo = document.getElementById('couponCodeField');
    const campoValor = document.getElementById('couponValorField');
    const campoTope = document.getElementById('couponTopeField');
    const inputValor = document.getElementById('couponValor');

    function actualizarVisibilidadPorTipo() {
        const tipo = document.querySelector('input[name="tipo"]:checked')?.value;
        const esEnvioGratis = tipo === 'envio_gratis';

        campoValor.style.display = esEnvioGratis ? 'none' : '';
        inputValor.required = !esEnvioGratis;
        campoTope.style.display = tipo === 'porcentaje' ? '' : 'none';
    }

    document.querySelectorAll('input[name="tipo"]').forEach((radio) => {
        radio.addEventListener('change', actualizarVisibilidadPorTipo);
    });

    window.openCouponModal = function (opciones) {
        form.action = opciones.action;
        title.textContent = opciones.title;

        document.getElementById('couponCodigo').value = opciones.codigo || '';
        document.getElementById('couponDescripcion').value = opciones.descripcion || '';
        document.getElementById('couponValor').value = opciones.valor || '';
        document.getElementById('couponCompraMinima').value = opciones.compraMinima || 0;
        document.getElementById('couponTope').value = opciones.topeMaximo || '';
        document.getElementById('couponFechaInicio').value = opciones.fechaInicio || '';
        document.getElementById('couponFechaFin').value = opciones.fechaFin || '';
        document.getElementById('couponLimiteUsos').value = opciones.limiteUsos || '';
        document.getElementById('couponLimitePorCliente').value = opciones.limitePorCliente || 1;
        document.getElementById('couponActivo').checked = opciones.activo !== false;

        const radioTipo = document.querySelector(`input[name="tipo"][value="${opciones.tipo || 'porcentaje'}"]`);
        if (radioTipo) radioTipo.checked = true;

        // El código no se puede editar una vez creado (es el identificador que el cliente ya usó/conoce)
        if (opciones.esEdicion) {
            campoCodigo.style.display = 'none';
            document.getElementById('couponCodigo').required = false;
        } else {
            campoCodigo.style.display = '';
            document.getElementById('couponCodigo').required = true;
        }

        actualizarVisibilidadPorTipo();

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.closeCouponModal = function () {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        if (window.__editarCupon) {
            window.location.href = '/admin/cupones';
        }
    };

    window.openCreateCouponModal = function () {
        openCouponModal({
            action: '/admin/cupones',
            title: 'Nuevo Cupón',
            esEdicion: false,
            fechaInicio: new Date().toISOString().slice(0, 10)
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (window.__editarCupon) {
            const c = window.__editarCupon;
            openCouponModal({
                action: `/admin/cupones/${c.id}/editar`,
                title: 'Editar Cupón',
                esEdicion: true,
                ...c
            });
        }
    });
})();