// Lógica del panel de detalle de pedido (drawer lateral).
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('order-modal');
    if (!modal) return;

    const abrir = () => modal.classList.remove('hidden');
    const cerrar = () => modal.classList.add('hidden');

    document.querySelectorAll('[data-abrir-detalle-pedido]').forEach((boton) => {
        boton.addEventListener('click', abrir);
    });

    document.querySelectorAll('[data-cerrar-detalle-pedido]').forEach((el) => {
        el.addEventListener('click', cerrar);
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') cerrar();
    });
});