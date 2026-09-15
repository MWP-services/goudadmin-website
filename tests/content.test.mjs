import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler, validateContent, isEditor } from '../api/lib/content.js';

const initial = JSON.parse(readFileSync(new URL('../src/content.json', import.meta.url)));
const principal = roles => Buffer.from(JSON.stringify({ userId: 'test-user', userRoles: roles })).toString('base64');
const request = (content = initial, headers = {}) => new Request('https://goudadmin.nl/api/content', {
  method: 'PUT', headers: { 'content-type': 'application/json', 'x-goudadmin-editor': '1', 'if-match': '"1"', 'x-ms-client-principal': principal(['content-editor']), ...headers }, body: JSON.stringify(content)
});

test('only the assigned editor can write, including direct API requests', async () => {
  const handler = createHandler({ write() { assert.fail('Unauthorized write'); } });
  for (const value of ['', 'invalid', principal(['anonymous']), principal(['authenticated'])]) {
    assert.equal((await handler(request(initial, { 'x-ms-client-principal': value }))).status, 403);
  }
  assert.equal(isEditor(principal(['content-editor'])), true);
});

test('content is limited to the photo and exactly four fixed service cards', () => {
  assert.deepEqual(validateContent(initial), initial);
  for (const content of [null, { ...initial, footer: 'changed' }, { ...initial, services: [] }, { ...initial, photo: 'https://other.test/image.svg' }, { ...initial, photo: 'data:image/jpeg;base64,YWJj' }]) assert.throws(() => validateContent(content));
  for (const patch of [{ title: '' }, { title: ' '.repeat(10) }, { title: 'x'.repeat(101) }, { details: 42 }, { extra: 'no' }]) {
    const content = structuredClone(initial); Object.assign(content.services[0], patch); assert.throws(() => validateContent(content));
  }
});

test('public reads and authorized saves persist together and return the new version', async () => {
  let content = structuredClone(initial), etag = '"1"';
  const handler = createHandler({
    async read() { return { content, etag }; },
    async write(next, match) { assert.equal(match, etag); content = next; etag = '"2"'; return etag; }
  });
  const draft = structuredClone(initial); draft.services[0].title = 'Nieuwe titel';
  assert.equal((await handler(request(draft))).headers.ETag, '"2"');
  const result = await handler(new Request('https://goudadmin.nl/api/content'));
  assert.equal(result.jsonBody.services[0].title, 'Nieuwe titel');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('stale versions and storage outages produce actionable errors', async () => {
  for (const [statusCode, expected] of [[412, 409], [409, 409], [500, 503]]) {
    const handler = createHandler({ async write() { throw Object.assign(new Error('secret connection string'), { statusCode }); } });
    const result = await handler(request());
    assert.equal(result.status, expected); assert.ok(!result.jsonBody.error.includes('secret'));
  }
});

test('malformed, oversized, or non-editor requests cannot write', async () => {
  const handler = createHandler({ write() { assert.fail('Invalid write'); } });
  assert.equal((await handler(request(initial, { 'x-goudadmin-editor': '' }))).status, 400);
  assert.equal((await handler(request(initial, { 'if-match': '' }))).status, 428);
  assert.equal((await handler(request(initial, { 'content-length': '1600000' }))).status, 413);
  assert.equal((await handler(request({ ...initial, photo: 'x'.repeat(1_500_000) }))).status, 413);
  assert.equal((await handler(request({ ...initial, services: [] }))).status, 400);
});

test('Azure configuration guards publishing and shipped defaults match the website', () => {
  const config = JSON.parse(readFileSync(new URL('../src/staticwebapp.config.json', import.meta.url)));
  assert.deepEqual(config.routes.find(route => route.route === '/api/content').allowedRoles, ['content-editor']);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../api/default-content.json', import.meta.url))), initial);
});
