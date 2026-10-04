type Route = { method: string; path: string };

export type App = { request: (path: string) => Response; routes: readonly Route[] };

export function createApp(): App {
    return {
        request: (path) => {
            const name = new URL(path, 'http://app').searchParams.get('name') ?? 'world';
            return Response.json({ greeting: `Hello, ${name}.` });
        },
        routes: [{ method: 'GET', path: '/greeting' }],
    };
}
