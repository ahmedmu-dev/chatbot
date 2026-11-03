import type { Server } from 'http';

import type { Express } from 'express';

export const HOST = '0.0.0.0';
export const DEFAULT_PORT = 8787;

export function getPort(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PORT?.trim();
  return raw ? Number(raw) : DEFAULT_PORT;
}

export function startServer(
  app: Express,
  env: Record<string, string | undefined> = process.env,
): Server {
  const port = getPort(env);
  return app.listen(port, HOST, () => {
    console.warn(`Parley proxy listening on ${HOST}:${port} (${env.LLM_PROVIDER || 'anthropic'})`);
  });
}
