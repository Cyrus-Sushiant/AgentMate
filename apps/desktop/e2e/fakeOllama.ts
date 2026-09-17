import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeOllama {
  /** Goes in the `ollamaBaseUrl` setting. */
  url: string;
  /** Every prompt the app sent, oldest first. */
  prompts: string[];
  close: () => Promise<void>;
}

/**
 * Stands in for Ollama's /api/chat so an AI task follows a fixed script. Each request gets the
 * next reply; once the script runs out, the task is told it's finished.
 */
export async function startFakeOllama(replies: string[]): Promise<FakeOllama> {
  const queue = [...replies];
  const prompts: string[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      if (request.method !== 'POST' || request.url !== '/api/chat') {
        response.writeHead(404).end();
        return;
      }
      const { messages } = JSON.parse(body) as { messages: { content: string }[] };
      prompts.push(messages.at(-1)?.content ?? '');
      const content = queue.shift() ?? 'FINISHED: out of script';
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: { role: 'assistant', content }, done: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    prompts,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
