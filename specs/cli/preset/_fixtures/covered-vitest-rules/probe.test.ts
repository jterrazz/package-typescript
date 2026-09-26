import { expect, test } from 'vitest';

test('probe test with a snapshot matcher', () => {
    expect(1).toMatchSnapshot();
});
