/** @jest-environment node */
/// <reference types="node" />
import fs from 'fs';
import type { AddressInfo } from 'net';
import path from 'path';

import request from 'supertest';

import { createApp } from '../app';
import { FakeClient } from '../fakeClient';
import { DEFAULT_PORT, HOST, getPort, startServer } from '../listen';

const SERVER_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(SERVER_DIR, '..');

describe('AC-4: server listens on 0.0.0.0:8787', () => {
  it('defaults to port 8787 on host 0.0.0.0, PORT overrides the port', () => {
    expect(HOST).toBe('0.0.0.0');
    expect(DEFAULT_PORT).toBe(8787);
    expect(getPort({})).toBe(8787);
    expect(getPort({ PORT: '9000' })).toBe(9000);
  });

  it('binds all interfaces on PORT and GET /health returns 200 {"ok":true}', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const server = startServer(createApp(new FakeClient()), { PORT: '0' });
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const { address, port } = server.address() as AddressInfo;
      expect(address).toBe('0.0.0.0');
      const res = await request(`http://127.0.0.1:${port}`).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    } finally {
      await new Promise((resolve) => server.close(resolve));
      jest.restoreAllMocks();
    }
  });

  it('root package.json has an `npm run server` script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.server).toContain('server/index.ts');
  });
});

describe('AC-7: secrets stay out of git', () => {
  it('.gitignore covers server/.env', () => {
    const lines = fs
      .readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim());
    expect(lines).toContain('server/.env');
  });

  it('server/.env.example lists ANTHROPIC_API_KEY, LLM_PROVIDER and PORT with empty values', () => {
    const entries = Object.fromEntries(
      fs
        .readFileSync(path.join(SERVER_DIR, '.env.example'), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => l.split('=') as [string, string]),
    );
    expect(entries).toEqual({ ANTHROPIC_API_KEY: '', LLM_PROVIDER: '', PORT: '' });
  });
});
