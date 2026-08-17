import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { walkRepoFiles } from '../src/services/ai/fileWalker';

/**
 * Security-critical guarantee (Module 7 plan §5): `.env`/`.env.*`/`*.pem`/
 * `*.key`/`*.p12`/`id_rsa*` are NEVER indexed, hard-coded, not
 * env-overridable. This test proves it against a real temp directory rather
 * than just eyeballing the regex in fileWalker.ts.
 */
describe('ai fileWalker — security exclusions', () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-filewalker-test-'));
    await fs.writeFile(path.join(root, '.env'), 'SECRET=1\n');
    await fs.writeFile(path.join(root, '.env.local'), 'SECRET=2\n');
    await fs.writeFile(path.join(root, '.env.example'), 'SECRET=example\n');
    await fs.writeFile(path.join(root, 'server.pem'), 'not-really-a-cert\n');
    await fs.writeFile(path.join(root, 'client.key'), 'not-really-a-key\n');
    await fs.writeFile(path.join(root, 'cert.p12'), 'binary-ish\n');
    await fs.writeFile(path.join(root, 'id_rsa'), 'private-key-material\n');
    await fs.writeFile(path.join(root, 'id_rsa.pub'), 'public-key-material\n');
    // Control case: an ordinary allow-listed file that SHOULD be indexed.
    await fs.writeFile(path.join(root, 'index.ts'), 'export const ok = true;\n');
    // node_modules should never be descended into either.
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(path.join(root, 'node_modules', 'leaked.ts'), 'export const leaked = true;\n');
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('never returns .env, .env.local, *.pem, *.key, *.p12, or id_rsa*', async () => {
    const files = await walkRepoFiles(root);
    const relativePaths = files.map((f) => f.relativePath);

    expect(relativePaths).not.toContain('.env');
    expect(relativePaths).not.toContain('.env.local');
    expect(relativePaths.some((p) => p.endsWith('.pem'))).toBe(false);
    expect(relativePaths.some((p) => p.endsWith('.key'))).toBe(false);
    expect(relativePaths.some((p) => p.endsWith('.p12'))).toBe(false);
    expect(relativePaths.some((p) => p.startsWith('id_rsa'))).toBe(false);
  });

  it('never descends into node_modules', async () => {
    const files = await walkRepoFiles(root);
    expect(files.some((f) => f.relativePath.includes('node_modules'))).toBe(false);
  });

  it('still indexes an ordinary allow-listed file (control case — proves exclusions are targeted, not "everything")', async () => {
    const files = await walkRepoFiles(root);
    expect(files.map((f) => f.relativePath)).toContain('index.ts');
  });
});
