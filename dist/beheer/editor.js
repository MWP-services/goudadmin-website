import { renderContent } from '/content-view.js';

const $ = selector => document.querySelector(selector);
const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let saved, draft, etag, busy = false, changed = false, canPublish = false;
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };

function update() {
  changed = JSON.stringify(draft) !== JSON.stringify(saved);
  $('#photo-preview').src = draft.photo;
  renderContent($('#preview'), draft);
  $('#publish').disabled = busy || !changed || !canPublish;
  $('#reset').disabled = busy || !changed;
  $('#save-state').textContent = busy ? 'Even geduld…' : changed ? 'Nog niet gepubliceerd' : 'Geen wijzigingen';
}

function populate() {
  $('#service-fields').replaceChildren();
  draft.services.forEach((service, index) => {
    const section = document.createElement('div');
    section.className = 'service-fields';
    const heading = document.createElement('h3');
    heading.textContent = `Kaartje ${index + 1}`;
    section.append(heading);
    for (const [key, label, max] of [['title', 'Titel', 100], ['description', 'Korte beschrijving', 500], ['details', 'Toelichting', 700]]) {
      const id = `service-${index}-${key}`;
      const caption = document.createElement('label');
      caption.htmlFor = id; caption.textContent = label;
      const field = document.createElement(key === 'title' ? 'input' : 'textarea');
      field.id = id; field.value = service[key]; field.maxLength = max; field.required = true;
      const help = document.createElement('span');
      help.className = 'field-help'; help.id = `${id}-help`;
      field.setAttribute('aria-describedby', help.id);
      const count = () => { help.textContent = `${field.value.length} / ${max} tekens`; };
      count();
      field.addEventListener('input', () => {
        field.setCustomValidity(field.value.trim() ? '' : 'Vul hier een tekst in.');
        draft.services[index][key] = field.value; count(); update();
      });
      section.append(caption, field, help);
    }
    $('#service-fields').append(section);
  });
  update();
}

async function photoData(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Kies een JPG-, PNG- of WebP-foto.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Deze foto is groter dan 10 MB. Kies een kleinere foto.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Deze foto kan niet worden geopend. Kies een andere foto.'); });
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .82);
    if (data.length > 1_400_000) throw new Error('Deze foto bevat te veel detail. Kies een kleinere foto.');
    return data;
  } finally { bitmap.close(); }
}

$('#photo').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  busy = true; $('#fields').disabled = true; update();
  try { draft.photo = await photoData(file); status('Je nieuwe foto staat in het voorbeeld. Publiceer om deze op de website te plaatsen.'); }
  catch (error) { status(error.message, true); }
  finally { busy = false; $('#fields').disabled = false; event.target.value = ''; update(); }
});

$('#reset').addEventListener('click', () => {
  if (!confirm('Je niet-gepubliceerde wijzigingen herstellen naar de laatst geladen versie?')) return;
  draft = structuredClone(saved); populate(); status('Je wijzigingen zijn hersteld.');
});

$('#editor-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!canPublish || busy || !changed || !event.target.reportValidity()) return;
  busy = true; $('#fields').disabled = true; update(); status('Je wijzigingen worden gepubliceerd…');
  try {
    const response = await fetch('/api/content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': etag, 'X-Goudadmin-Editor': '1' }, body: JSON.stringify(draft)
    });
    if (response.status === 401 || response.status === 403) throw new Error('Je sessie is verlopen of je hebt geen toegang. Kopieer je aangepaste teksten en log opnieuw in.');
    const result = await response.json().catch(() => { throw new Error('Publiceren is niet gelukt. Je wijzigingen staan nog in het formulier. Probeer het opnieuw.'); });
    if (!response.ok) throw new Error(result.error || 'Publiceren is niet gelukt. Probeer het opnieuw.');
    etag = response.headers.get('etag'); saved = result; draft = structuredClone(saved); populate();
    status('Gepubliceerd! Je nieuwe foto en teksten zijn zichtbaar wanneer bezoekers de website openen of vernieuwen.');
  } catch (error) { status(error instanceof TypeError ? 'Geen verbinding. Je wijzigingen staan nog in het formulier. Probeer het opnieuw.' : error.message, true); }
  finally { busy = false; $('#fields').disabled = false; update(); }
});

window.addEventListener('beforeunload', event => { if (changed || busy) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  $('#login-link').href = `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(location.origin + '/beheer/')}`;
  if (!localPreview) {
    const auth = await fetch('/.auth/me', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Inloggen is momenteel niet beschikbaar. Probeer het later opnieuw.');
      return response.json();
    });
    if (!auth.clientPrincipal?.userRoles?.includes('content_editor')) {
      $('#login-panel').hidden = false;
      status(auth.clientPrincipal ? 'Dit account heeft geen bewerktoegang. Neem contact op met je websitebeheerder.' : 'Log in om je foto en diensten bij te werken.');
      if (auth.clientPrincipal) {
        const logout = document.createElement('a'); logout.href = '/.auth/logout'; logout.textContent = 'Uitloggen om een ander account te gebruiken';
        $('#login-panel').append(document.createElement('p'), logout);
      }
      return;
    }
    $('#account').textContent = `Ingelogd als ${auth.clientPrincipal.userDetails}`;
  }
  const response = await fetch(localPreview ? '/content.json' : '/api/content', { cache: 'no-store' });
  if (!response.ok) throw new Error('Je websitegegevens kunnen niet worden geladen. Vernieuw de pagina of neem contact op met je websitebeheerder.');
  saved = await response.json(); draft = structuredClone(saved); etag = response.headers.get('etag');
  canPublish = !localPreview && Boolean(etag);
  for (let index = 0; index < 4; index++) {
    const card = document.createElement('details'); card.className = 'service-card'; card.open = true;
    card.innerHTML = '<summary><span class="service-title"></span></summary><p></p><p class="service-more"></p>';
    $('#preview').append(card);
  }
  $('#editor').hidden = false;
  if (localPreview) { $('#logout').hidden = true; $('#account').textContent = 'Lokaal voorbeeld'; }
  populate();
  status(localPreview ? 'Dit is een lokaal voorbeeld. Je kunt alles uitproberen; publiceren is pas beschikbaar na inrichting van de online beheeromgeving. Je wijzigingen worden hier niet opgeslagen.' : 'Je kunt aan de slag. Wijzigingen verschijnen pas op de website nadat je op Publiceren klikt.');
}
start().catch(error => status(error.message || 'De beheerpagina kan niet worden geladen. Vernieuw de pagina.', true));
