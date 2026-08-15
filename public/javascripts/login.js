const btnVerContrasena = document.querySelector('#btnVerContrasena');
const password = document.querySelector('#password');
const iconoVisibilidad = document.querySelector('#iconoVisibilidad');

btnVerContrasena.addEventListener('click', (e) => {
    if(password.type === 'password') {
        password.type = 'text';
        iconoVisibilidad.textContent = 'visibility';
    } else {
        password.type = 'password';
        iconoVisibilidad.textContent = 'visibility_off';
    }
})