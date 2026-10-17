import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import process from 'node:process';

import { createApp } from './app.js';

const app = createApp();

async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const answered = app.request(request.url ?? '/');
    response.writeHead(answered.status, { 'content-type': 'application/json' });
    response.end(await answered.text());
}

createServer((request, response) => {
    void respond(request, response);
}).listen(Number(process.env.PORT ?? 3000));
