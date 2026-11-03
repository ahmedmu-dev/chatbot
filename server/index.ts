import path from 'path';

import dotenv from 'dotenv';

import { AnthropicClient } from './anthropicClient';
import { createApp } from './app';
import { FakeClient } from './fakeClient';
import { startServer } from './listen';
import type { LlmClient } from './types';

dotenv.config({ path: path.join(__dirname, '.env') });

function createClient(): LlmClient {
  if (process.env.LLM_PROVIDER === 'fake') return new FakeClient();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(
      'ANTHROPIC_API_KEY is missing. Copy server/.env.example to server/.env and fill it in, or set LLM_PROVIDER=fake.',
    );
    process.exit(1);
  }
  return new AnthropicClient(key);
}

startServer(createApp(createClient()));
