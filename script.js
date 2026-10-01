// Куда отправлять заявки. Заполните одно из двух:
// FORM_ENDPOINT — адрес сервиса форм (например, Formspree), принимает POST с JSON;
// CLUB_EMAIL — почта: без FORM_ENDPOINT заявка откроется письмом в почтовой программе.
const FORM_ENDPOINT = '';
const CLUB_EMAIL = '';

const form = document.getElementById('apply-form');
const status = form.querySelector('.form__status');

function setStatus(text, kind) {
  status.textContent = text;
  status.className = 'form__status' + (kind ? ' is-' + kind : '');
}

function validate() {
  let firstInvalid = null;
  form.querySelectorAll('[required]').forEach((el) => {
    const ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok && !firstInvalid) firstInvalid = el;
  });
  return firstInvalid;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const invalid = validate();
  if (invalid) {
    setStatus(invalid.type === 'checkbox'
      ? 'Нужно согласие на обработку персональных данных.'
      : 'Заполните, пожалуйста, обязательные поля.', 'error');
    invalid.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  delete data.consent;

  if (FORM_ENDPOINT) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus('Отправляем…');
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      setStatus('Спасибо! Заявка отправлена, мы свяжемся с вами.', 'ok');
    } catch {
      setStatus('Не получилось отправить. Попробуйте ещё раз чуть позже.', 'error');
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (CLUB_EMAIL) {
    const body = [
      'Имя: ' + data.name,
      'Телефон: ' + data.phone,
      'Telegram: ' + (data.telegram || '—'),
      'Бизнес / должность: ' + data.business,
      'Ожидания: ' + (data.expectations || '—'),
    ].join('\n');
    window.location.href = 'mailto:' + CLUB_EMAIL
      + '?subject=' + encodeURIComponent('Заявка в клуб: ' + data.name)
      + '&body=' + encodeURIComponent(body);
    setStatus('Откроется письмо с заявкой. Отправьте его, и мы свяжемся с вами.', 'ok');
    return;
  }

  setStatus('Приём заявок скоро заработает.', 'error');
});
