import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { objectOf } from '../../../../lint/kit/project/json.js';
import {
    KILLERS_VARIABLE,
    PREVIOUS_KILLERS,
    RECENT_KILLERS_VARIABLE,
} from '../previous-killers.js';

const PRICE = 'export const price = (amount: number): number => amount * 2;\n';

const at = (line: number, from: number, to: number): object => ({
    end: { column: to, line },
    start: { column: from, line },
});

const LAST_REPORT = {
    files: {
        'src/price.ts': {
            mutants: [
                {
                    killedBy: ['2'],
                    location: at(1, 50, 60),
                    mutatorName: 'ArithmeticOperator',
                    replacement: 'amount / 2',
                },
                {
                    location: at(1, 22, 60),
                    mutatorName: 'ArrowFunction',
                    replacement: '() => undefined',
                },
            ],
            source: PRICE,
        },
    },
    testFiles: {
        'specs/quick.spec.ts': { tests: [{ id: '1' }] },
        'specs/slow.spec.ts': { tests: [{ id: '2' }] },
    },
};

type Reporter = {
    onMutantTested: (result: object) => void;
    onMutationTestingPlanReady: (event: { mutantPlans: unknown[] }) => void;
};

type ReporterClass = new (options: unknown) => Reporter;

const isClass = (value: unknown): value is ReporterClass => typeof value === 'function';

async function planned(
    project: string,
    report: string,
    mutantPlans: unknown[],
): Promise<{ name: unknown; written: unknown }> {
    const imported: unknown = await import(
        `data:text/javascript,${encodeURIComponent(PREVIOUS_KILLERS.source)}`
    );
    const [plugin] = Object.values(objectOf(imported)).flat();
    const { injectableClass, name } = objectOf(plugin);
    const into = join(project, 'killers.json');
    vi.stubEnv(KILLERS_VARIABLE, into);
    vi.spyOn(process, 'cwd').mockReturnValue(project);
    onTestFinished(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });
    if (isClass(injectableClass)) {
        new injectableClass({ jsonReporter: { fileName: report } }).onMutationTestingPlanReady({
            mutantPlans,
        });
    }

    return {
        name,
        written: existsSync(into) ? JSON.parse(readFileSync(into, 'utf8')) : undefined,
    };
}

async function tested(project: string, results: object[]): Promise<string> {
    const imported: unknown = await import(
        `data:text/javascript,${encodeURIComponent(PREVIOUS_KILLERS.source)}`
    );
    const [plugin] = Object.values(objectOf(imported)).flat();
    const { injectableClass } = objectOf(plugin);
    const into = join(project, 'recent.jsonl');
    vi.stubEnv(RECENT_KILLERS_VARIABLE, into);
    vi.spyOn(process, 'cwd').mockReturnValue(project);
    onTestFinished(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });
    if (isClass(injectableClass)) {
        const reporter = new injectableClass({ jsonReporter: { fileName: 'report.json' } });
        for (const result of results) {
            reporter.onMutantTested(result);
        }
    }

    return existsSync(into) ? readFileSync(into, 'utf8') : '';
}

function projectWith(source: string): string {
    const project = mkdtempSync(join(tmpdir(), 'previous-killers-'));
    onTestFinished(() => {
        rmSync(project, { force: true, recursive: true });
    });
    mkdirSync(join(project, 'src'));
    writeFileSync(join(project, 'src/price.ts'), source);

    return project;
}

const mutant = (project: string, id: string, fields: object): object => ({
    fileName: join(project, 'src/price.ts'),
    id,
    ...fields,
});

describe('previous-killers', () => {
    test('a mutant planned to run is mapped to the test file that killed it in the last report, though a line moved its source down', async () => {
        // Given - the last report, whose slow spec killed the doubling's operator mutant, and the source since a comment above it
        const project = projectWith(`// the price doubles\n${PRICE}`);
        const report = join(project, 'report.json');
        writeFileSync(report, JSON.stringify(LAST_REPORT));
        const operator = { mutatorName: 'ArithmeticOperator', replacement: 'amount / 2' };

        // When - the stage plans the same operator mutant one line lower, one the last report never killed, one it settles early, and a different replacement
        const { name, written } = await planned(project, report, [
            { mutant: mutant(project, '5', { ...operator, location: at(1, 49, 59) }), plan: 'Run' },
            {
                mutant: mutant(project, '6', {
                    location: at(1, 21, 59),
                    mutatorName: 'ArrowFunction',
                    replacement: '() => undefined',
                }),
                plan: 'Run',
            },
            {
                mutant: mutant(project, '7', { ...operator, location: at(1, 49, 59) }),
                plan: 'EarlyResult',
            },
            {
                mutant: mutant(project, '8', {
                    ...operator,
                    location: at(1, 49, 59),
                    replacement: 'amount + 2',
                }),
                plan: 'Run',
            },
        ]);

        // Then - only the moved operator mutant is mapped, to the slow spec
        expect({ name, written }).toStrictEqual({
            name: PREVIOUS_KILLERS.name,
            written: { 5: 'specs/slow.spec.ts' },
        });
    });

    test('a stage with no last report maps nothing', async () => {
        // Given - a project whose stage never wrote a report
        const project = projectWith(PRICE);

        // When - the stage plans a mutant
        const { written } = await planned(project, join(project, 'report.json'), [
            {
                mutant: mutant(project, '5', {
                    location: at(1, 49, 59),
                    mutatorName: 'ArithmeticOperator',
                    replacement: 'amount / 2',
                }),
                plan: 'Run',
            },
        ]);

        // Then - no map is written for the sequencer to read
        expect(written).toBeUndefined();
    });

    test('each mutant a stage kills is appended as its source and the file of the test that killed it; a mutant no test killed adds nothing', async () => {
        // Given - a project whose price a stage mutates
        const project = projectWith(PRICE);
        const fileName = join(project, 'src/price.ts');

        // When - two mutants are killed, one by a test whose name holds a hash, and one survives
        const appended = await tested(project, [
            { fileName, killedBy: ['specs/slow.spec.ts#a > b'], status: 'Killed' },
            { fileName, killedBy: [], status: 'Survived' },
            { fileName, killedBy: ['specs/quick.spec.ts#c #1'], status: 'Killed' },
        ]);

        // Then - two lines, in the order the kills came
        expect(appended).toBe(
            `${JSON.stringify({ killer: 'specs/slow.spec.ts', source: 'src/price.ts' })}\n${JSON.stringify({ killer: 'specs/quick.spec.ts', source: 'src/price.ts' })}\n`,
        );
    });
});
