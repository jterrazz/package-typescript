import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('greeting', () => {
    test('greets the name it is asked for', async () => {
        // Given - a name in the query
        const result = await api.get('/greeting?name=Ada');

        // Then - the greeting carries it
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "greeting": "Hello, Ada."
            }
        `);
    });
});
