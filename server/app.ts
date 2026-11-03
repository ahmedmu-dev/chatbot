import express, { type ErrorRequestHandler, type Request, type Response } from 'express';

import { HTTP_STATUS, ProxyError, toProxyError } from './errors';
import type { ChatMessage, LlmClient } from './types';

function parseBody(body: unknown): { messages: ChatMessage[]; model?: string; system?: string } {
  if (typeof body !== 'object' || body === null) throw new ProxyError('bad_request');
  const { messages, model, system } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) throw new ProxyError('bad_request');
  const parsed: ChatMessage[] = messages.map((m: unknown) => {
    if (typeof m !== 'object' || m === null) throw new ProxyError('bad_request');
    const { role, content } = m as Record<string, unknown>;
    if (
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      !content.trim()
    ) {
      throw new ProxyError('bad_request');
    }
    return { role, content };
  });
  if (model !== undefined && (typeof model !== 'string' || !model)) {
    throw new ProxyError('bad_request');
  }
  if (system !== undefined && typeof system !== 'string') throw new ProxyError('bad_request');
  return { messages: parsed, model, system };
}

function sendError(res: Response, err: ProxyError): void {
  res.status(HTTP_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
}

export function createApp(llm: LlmClient) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const params = parseBody(req.body);
      const content = await llm.complete(params);
      res.json({ content });
    } catch (err) {
      const proxyError = toProxyError(err);
      // Log the code only: never the key or message contents.
      console.error(`POST /api/chat failed: ${proxyError.code}`);
      sendError(res, proxyError);
    }
  });

  // Malformed JSON and other body-parser failures come in with a 4xx status.
  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    const status = (err as { status?: unknown }).status;
    sendError(
      res,
      new ProxyError(typeof status === 'number' && status < 500 ? 'bad_request' : 'unknown'),
    );
  };
  app.use(onError);

  return app;
}
