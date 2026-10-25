(() => {
  const deposit = document.querySelector('#deposit-field');
  const field = document.querySelector('#deposit_location');
  const label = document.querySelector('#event-location-label');
  const update = () => {
    const kind = document.querySelector('[name=kind]:checked')?.value;
    deposit.hidden = kind !== 'found';
    field.disabled = kind !== 'found';
    field.required = kind === 'found';
    label.textContent =
      kind === 'found' ? 'Lugar del hallazgo' : 'Último lugar conocido';
  };
  document
    .querySelectorAll('[name=kind]')
    .forEach((input) => input.addEventListener('change', update));
  update();
})();
