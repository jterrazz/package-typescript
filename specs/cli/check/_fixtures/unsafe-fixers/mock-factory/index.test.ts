import { vi } from 'vitest';

vi.mock('node:fs', () => ({ readFileSync: vi.fn<() => string>() }));
