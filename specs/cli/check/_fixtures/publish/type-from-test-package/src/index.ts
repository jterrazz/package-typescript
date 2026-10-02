import type { Mock } from 'vitest';

export type LengthProbe = Mock<(input: string) => number>;

export const length = (input: string): number => input.length;
