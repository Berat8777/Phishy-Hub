import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, bearer } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';

// A real, minimal 1x1 transparent PNG — used to exercise magic-byte
// detection with a deliberately WRONG declared Content-Type/filename.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('file service', () => {
  let app: Express;
  let session: AuthedSession;

  beforeAll(async () => {
    app = buildApp();
    session = await registerAndLogin(app);
  });

  it('happy path: upload a plain text file, detected mime matches content', async () => {
    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(session.accessToken))
      .attach('file', Buffer.from('just some plain text content'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.originalName).toBe('note.txt');
    expect(res.body.data.sizeBytes).toBeGreaterThan(0);
  });

  it('no file attached -> 400 BAD_REQUEST', async () => {
    const res = await request(app).post('/api/v1/files').set('Authorization', bearer(session.accessToken));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('regression: oversized upload is rejected (413), not accepted or 500', async () => {
    // testEnv.ts pins MAX_UPLOAD_SIZE_MB=2 for the whole suite so this test
    // doesn't need to push a real 25MB+ payload through supertest.
    const oversized = Buffer.alloc(3 * 1024 * 1024, 'x');
    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(session.accessToken))
      .attach('file', oversized, { filename: 'big.bin', contentType: 'application/octet-stream' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('UPLOAD_LIMIT_FILE_SIZE');
  });

  it('regression: a spoofed declared Content-Type is overridden by magic-byte detection', async () => {
    const res = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(session.accessToken))
      // Real PNG bytes, but declared as a .txt/text/plain — the server must
      // not trust the client's stated type for a binary format it can sniff.
      .attach('file', TINY_PNG, { filename: 'not-really-a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body.data.mimeType).toBe('image/png');
    expect(res.body.data.hasThumbnail).toBe(true);
  });

  it('delete: only the uploader or an admin may delete; deleted file 404s afterward', async () => {
    const uploaderSession = await registerAndLogin(app);
    const otherSession = await registerAndLogin(app);

    const uploadRes = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(uploaderSession.accessToken))
      .attach('file', Buffer.from('delete me'), { filename: 'todelete.txt', contentType: 'text/plain' });
    const fileId = uploadRes.body.data.id;

    const forbidden = await request(app)
      .delete(`/api/v1/files/${fileId}`)
      .set('Authorization', bearer(otherSession.accessToken));
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/v1/files/${fileId}`)
      .set('Authorization', bearer(uploaderSession.accessToken));
    expect(allowed.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', bearer(uploaderSession.accessToken));
    expect(afterDelete.status).toBe(404);
  });

  it('an orphaned file (uploaded, never attached anywhere) is visible only to its uploader', async () => {
    const uploaderSession = await registerAndLogin(app);
    const strangerSession = await registerAndLogin(app);

    const uploadRes = await request(app)
      .post('/api/v1/files')
      .set('Authorization', bearer(uploaderSession.accessToken))
      .attach('file', Buffer.from('nobody attached me'), { filename: 'orphan.txt', contentType: 'text/plain' });
    const fileId = uploadRes.body.data.id;

    const asStranger = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', bearer(strangerSession.accessToken));
    expect(asStranger.status).toBe(403);

    const asUploader = await request(app)
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', bearer(uploaderSession.accessToken));
    expect(asUploader.status).toBe(200);
  });
});
