/** @jest-environment node */
import request from 'supertest';

import { createApp } from '../app';
import { FakeClient } from '../fakeClient';

const app = createApp(new FakeClient());
const post = (messages: { role: string; content: string }[]) =>
  request(app).post('/api/chat').send({ messages });

describe('AC-7a: LLM_PROVIDER=fake', () => {
  it('replies deterministically, echoing the last user message', async () => {
    const a = await post([{ role: 'user', content: 'hello' }]);
    const b = await post([{ role: 'user', content: 'hello' }]);
    expect(a.status).toBe(200);
    expect(a.body.content).toBe('You said: hello\nEarlier messages: none');
    expect(b.body).toEqual(a.body);
  });

  it('lists the earlier user messages so follow-up context can be checked', async () => {
    const res = await post([
      { role: 'user', content: 'what is 2+2' },
      { role: 'assistant', content: 'You said: what is 2+2' },
      { role: 'user', content: 'what did I just ask?' },
    ]);
    expect(res.body.content).toBe(
      'You said: what did I just ask?\nEarlier messages: 1\n- what is 2+2',
    );
  });

  it.each([
    ['auth', 502],
    ['rate_limit', 429],
    ['overloaded', 503],
    ['timeout', 504],
    ['network', 502],
    ['refused', 422],
    ['bad_request', 400],
  ])('[fail:%s] returns that AC-6 error', async (code, status) => {
    const res = await post([{ role: 'user', content: `please [fail:${code}] now` }]);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('ignores unknown fail codes', async () => {
    const res = await post([{ role: 'user', content: '[fail:bogus]' }]);
    expect(res.status).toBe(200);
  });

  it('needs no API key', async () => {
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect((await post([{ role: 'user', content: 'hi' }])).status).toBe(200);
  });
});
