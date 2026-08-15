const btnVerContrasena = document.querySelector('#btnVerContrasena');
const password = document.querySelector('#password');
const iconoVisibilidadContrasena = document.querySelector('#iconoVisibilidadContrasena');
const btnVerConfirmar = document.querySelector('#btnVerConfirmar');
const confirmPassword = document.querySelector('#confirm_password');
const iconoVisibilidadConfirmar = document.querySelector('#iconoVisibilidadConfirmar');

btnVerContrasena.addEventListener('click', (e) => {
    if(password.type === 'password') {
        password.type = 'text';
        iconoVisibilidadContrasena.textContent = 'visibility';
    } else {
        password.type = 'password';
        iconoVisibilidadContrasena.textContent = 'visibility_off';
    }
})

btnVerConfirmar.addEventListener('click', (e) => {
    if(confirmPassword.type === 'password') {
        confirmPassword.type = 'text';
        iconoVisibilidadConfirmar.textContent = 'visibility';
    } else {
        confirmPassword.type = 'password';
        iconoVisibilidadConfirmar.textContent = 'visibility_off';
    }
})