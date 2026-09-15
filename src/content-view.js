// Text is always inserted as text, never interpreted as HTML.
export function renderContent(root, content) {
  const photo = root.querySelector('.profile-photo');
  if (photo && (content.photo === '/assets/profielfoto.jpg' || /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(content.photo))) photo.src = content.photo;
  root.querySelectorAll('.service-card').forEach((card, index) => {
    const service = content.services?.[index];
    if (!service) return;
    card.querySelector('.service-title').textContent = service.title;
    card.querySelector('p').textContent = service.description;
    card.querySelector('.service-more').textContent = service.details;
  });
}

if (!document.body.hasAttribute('data-editor')) {
  fetch('/api/content', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(content => renderContent(document, content))
    .catch(() => {}); // The original content remains available if the API is unavailable.
}
