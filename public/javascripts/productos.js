const limpiarFiltro = document.querySelector('#limpiarFiltro');
const joyeria = document.querySelector('#joyeria');
const estimuladores = document.querySelector('#estimuladores');
const cosmetica = document.querySelector('#cosmetica');
const kits = document.querySelector('#kits');

limpiarFiltro.addEventListener('click', () => {
    joyeria.checked = false;
    estimuladores.checked = false;
    cosmetica.checked = false;
    kits.checked = false;
})