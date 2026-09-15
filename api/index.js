import { app } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { readFileSync } from 'node:fs';
import { createHandler } from './lib/content.js';

const defaults = JSON.parse(readFileSync(new URL('./default-content.json', import.meta.url), 'utf8'));
function blob() {
  const connection = process.env.CONTENT_STORAGE_CONNECTION_STRING;
  if (!connection) throw new Error('Content storage is not configured.');
  return BlobServiceClient.fromConnectionString(connection)
    .getContainerClient(process.env.CONTENT_STORAGE_CONTAINER || 'website-content')
    .getBlockBlobClient('content.json');
}
const store = {
  async read() {
    try {
      const response = await blob().download();
      const chunks = [];
      for await (const chunk of response.readableStreamBody) chunks.push(chunk);
      return { content: JSON.parse(Buffer.concat(chunks).toString('utf8')), etag: response.etag };
    } catch (error) {
      if (error.code === 'BlobNotFound') return { content: defaults, etag: '"initial"' };
      throw error;
    }
  },
  async write(content, etag) {
    const body = JSON.stringify(content);
    const result = await blob().upload(body, Buffer.byteLength(body), {
      conditions: etag === '"initial"' ? { ifNoneMatch: '*' } : { ifMatch: etag },
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' }
    });
    return result.etag;
  }
};
app.http('content', { methods: ['GET', 'PUT'], authLevel: 'anonymous', handler: createHandler(store) });
