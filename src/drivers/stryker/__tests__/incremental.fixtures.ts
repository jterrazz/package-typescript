import type { ObservedTest } from '../observed.js';

const mutant = (id: string, coveredBy: string[], killedBy: string[] = []) => ({
    coveredBy,
    id,
    killedBy,
    location: { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } },
    mutatorName: 'BooleanLiteral',
    status: killedBy.length > 0 ? 'Killed' : 'Survived',
});

const A_MUTANTS = [mutant('1', ['0', '1']), mutant('2', ['1'], ['1'])];

export const REPORT = {
    files: {
        'src/a.ts': { mutants: A_MUTANTS, source: 'a' },
        'src/b.ts': { mutants: [mutant('3', ['2'], ['2'])], source: 'b' },
    },
    schemaVersion: '2',
    testFiles: {
        'specs/a.spec.ts': { tests: [{ id: '1', name: 'a spec' }] },
        'src/__tests__/a.test.ts': { tests: [{ id: '0', name: 'a test' }] },
        'src/__tests__/b.test.ts': { tests: [{ id: '2', name: 'b test' }] },
    },
};

const quiet = (key: string): ObservedTest => ({ loaded: [], ran: [], test: key });

export const MODULE_TESTS = [
    quiet('src/__tests__/a.test.ts#a test'),
    quiet('src/__tests__/b.test.ts#b test'),
];

export const SPEC_QUIET = [...MODULE_TESTS, quiet('specs/a.spec.ts#a spec')];

export const SPEC_RAN_A = [
    ...MODULE_TESTS,
    {
        loaded: ['src/a.ts', 'src/b.ts', 'src/h.ts'],
        ran: ['src/a.ts'],
        test: 'specs/a.spec.ts#a spec',
    },
];

export const FILES = {
    'package.json': '{"name":"@scope/package"}',
    'specs/a.spec.ts': 'spec',
    'src/__tests__/a.test.ts': "import { a } from '../a.js';",
    'src/__tests__/b.test.ts': "import { b } from '../b.js';",
    'src/a.ts': 'a',
    'src/b.ts': "import { h } from './h.js';",
    'src/h.ts': 'export const H = 1;\n\nexport function h(): number {\n    return H;\n}\n',
};
