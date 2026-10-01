/** Mejoras del formulario: funciona también sin JavaScript mediante POST al servidor. */
document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.dataset.passwordToggle);
  const label = document
    .querySelector(`label[for="${input.id}"]`)
    .textContent.toLowerCase();
  button.hidden = false;
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute(
      'aria-label',
      `${visible ? 'Ocultar' : 'Mostrar'} ${label}`,
    );
  });
});
// Al volver del servidor con errores, llevar el foco al resumen para teclado y lector de pantalla.
document.querySelector('#form-errors')?.focus();
