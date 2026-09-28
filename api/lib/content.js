export const MAX_BODY = 1_500_000;

export function isEditor(encoded) {
  try {
    const principal = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return Boolean(principal.userId && principal.userRoles?.includes('content_editor'));
  } catch { return false; }
}

export function validateContent(value) {
  if (!value || Object.keys(value).sort().join() !== 'photo,services') throw new Error('Alleen de profielfoto en diensten kunnen worden gewijzigd.');
  if (typeof value.photo !== 'string') throw new Error('Kies een geldige foto.');
  if (value.photo !== '/assets/profielfoto.jpg') {
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.photo) || value.photo.length > 1_400_000) throw new Error('De foto is ongeldig of te groot. Kies een andere foto.');
    const bytes = Buffer.from(value.photo.split(',')[1], 'base64');
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('Kies een geldige JPEG-foto.');
  }
  if (!Array.isArray(value.services) || value.services.length !== 4) throw new Error('Er moeten precies vier dienstenkaartjes zijn.');
  const limits = { title: 100, description: 500, details: 700 };
  const services = value.services.map(service => {
    if (!service || Object.keys(service).sort().join() !== 'description,details,title') throw new Error('Een dienstenkaartje bevat ongeldige velden.');
    return Object.fromEntries(Object.entries(limits).map(([key, limit]) => {
      if (typeof service[key] !== 'string' || !service[key].trim() || service[key].length > limit) throw new Error('Vul alle teksten in en houd rekening met de maximale lengte.');
      return [key, service[key].trim()];
    }));
  });
  return { photo: value.photo, services };
}

export function createHandler(store) {
  return async request => {
    const reply = (status, jsonBody, extra = {}) => ({ status, jsonBody, headers: { 'Cache-Control': 'no-store', ...extra } });
    if (request.method === 'PUT') {
      if (!isEditor(request.headers.get('x-ms-client-principal'))) return reply(403, { error: 'Je hebt geen toegang om wijzigingen te publiceren.' });
      if (request.headers.get('x-goudadmin-editor') !== '1' || !request.headers.get('content-type')?.startsWith('application/json')) return reply(400, { error: 'Ongeldig verzoek.' });
      if (!request.headers.get('if-match')) return reply(428, { error: 'Laad de huidige inhoud opnieuw voordat je publiceert.' });
    }
    try {
      if (request.method === 'GET') {
        const current = await store.read();
        return reply(200, current.content, { ETag: current.etag });
      }
      if (request.method !== 'PUT') return reply(405, { error: 'Niet toegestaan.' });
      if (Number(request.headers.get('content-length')) > MAX_BODY) return reply(413, { error: 'De foto is te groot.' });
      const raw = await request.text();
      if (Buffer.byteLength(raw) > MAX_BODY) return reply(413, { error: 'De foto is te groot.' });
      let content;
      try { content = validateContent(JSON.parse(raw)); }
      catch (error) { return reply(400, { error: error instanceof SyntaxError ? 'Ongeldige inhoud.' : error.message }); }
      const etag = await store.write(content, request.headers.get('if-match'));
      return reply(200, content, { ETag: etag });
    } catch (error) {
      if (error.statusCode === 412 || error.statusCode === 409) return reply(409, { error: 'De website is ondertussen gewijzigd. Kopieer je aangepaste teksten en laad de pagina opnieuw om verder te gaan.' });
      return reply(503, { error: 'Opslaan of laden is momenteel niet mogelijk. Probeer het later opnieuw of neem contact op met je websitebeheerder.' });
    }
  };
}
