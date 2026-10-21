import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { MUTATION_OUTPUT } from '../../../lint/kit/project/build-plan.js';

const NAME = 'typescript-previous-killers';

/** The variable naming the file a stage maps each mutant it runs to, the test file that killed it in the stage's last report. */
export const KILLERS_VARIABLE = '__TYPESCRIPT_MUTATION_KILLERS__';

/** The variable naming the file a stage appends each mutant it kills to, as the mutant's source and the test file that killed it, one line each. */
export const RECENT_KILLERS_VARIABLE = '__TYPESCRIPT_MUTATION_RECENT_KILLERS__';

// invariant: a mutant is the last report's when its file, its mutator, its replacement and the code it replaces are the same, the nearest by line where several are, so a mutant whose source changed around it still finds its killer; Stryker plans every mutant before it runs one, so the map is written before the sequencer first reads it.
// invariant: a killed mutant's line is appended as Stryker reports it, whole, so a sequencer reading the file while a mutant is reported reads every line but the one being written.
const SOURCE = `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

const offsetOf = (lines, { column, line }) => lines.slice(0, line).reduce((sum, text) => sum + text.length + 1, 0) + column;
const textAt = (source, { end, start }) => {
    const lines = source.split('\\n');
    return source.slice(offsetOf(lines, start), offsetOf(lines, end));
};
const zeroBased = ({ column, line }) => ({ column: column - 1, line: line - 1 });
const keyOf = (file, { mutatorName, replacement }, text) => JSON.stringify([file, mutatorName, replacement, text]);

class PreviousKillers {
    static inject = ['options'];

    constructor(options) {
        this.report = options.jsonReporter.fileName;
    }

    onMutationTestingPlanReady({ mutantPlans }) {
        const into = process.env.${KILLERS_VARIABLE};
        if (into === undefined || !existsSync(this.report)) {
            return;
        }
        const last = JSON.parse(readFileSync(this.report, 'utf8'));
        const fileOfTest = new Map(Object.entries(last.testFiles ?? {}).flatMap(([file, { tests }]) => tests.map(({ id }) => [id, file])));
        const killers = new Map();
        for (const [file, { mutants, source }] of Object.entries(last.files ?? {})) {
            for (const mutant of mutants) {
                const killer = fileOfTest.get((mutant.killedBy ?? [])[0]);
                if (killer !== undefined) {
                    const location = { end: zeroBased(mutant.location.end), start: zeroBased(mutant.location.start) };
                    const key = keyOf(file, mutant, textAt(source, location));
                    killers.set(key, [...(killers.get(key) ?? []), { killer, line: location.start.line }]);
                }
            }
        }
        const sources = new Map();
        const killed = {};
        for (const { mutant, plan } of mutantPlans) {
            const file = relative(process.cwd(), mutant.fileName);
            if (plan === 'Run' && existsSync(mutant.fileName)) {
                const source = sources.get(file) ?? sources.set(file, readFileSync(mutant.fileName, 'utf8')).get(file);
                const distance = ({ line }) => Math.abs(line - mutant.location.start.line);
                const [nearest] = (killers.get(keyOf(file, mutant, textAt(source, mutant.location))) ?? []).toSorted((a, b) => distance(a) - distance(b));
                if (nearest !== undefined) {
                    killed[mutant.id] = nearest.killer;
                }
            }
        }
        writeFileSync(into, JSON.stringify(killed));
    }

    onMutantTested({ fileName, killedBy, status }) {
        const into = process.env.${RECENT_KILLERS_VARIABLE};
        const [test] = killedBy ?? [];
        if (into !== undefined && status === 'Killed' && test !== undefined) {
            const killer = test.slice(0, test.indexOf('#'));
            appendFileSync(into, \`\${JSON.stringify({ killer, source: relative(process.cwd(), fileName) })}\\n\`);
        }
    }
}

export const strykerPlugins = [{ injectableClass: PreviousKillers, kind: 'Reporter', name: '${NAME}' }];
`;

/** The reporter that maps each mutant a stage runs to its last killer: the file Stryker loads it from, its name, its source. */
export const PREVIOUS_KILLERS = {
    file: `${MUTATION_OUTPUT}/previous-killers.mjs`,
    name: NAME,
    source: SOURCE,
};

/** Lays the reporter a stage loads, and names where it writes its map and its kills for the sequencer, what an earlier run left of both taken away first. */
export function killersLaid(project: string, report: string): void {
    writeFileSync(join(project, PREVIOUS_KILLERS.file), PREVIOUS_KILLERS.source);
    const into = join(project, MUTATION_OUTPUT, `${report}-killers.json`);
    const recent = join(project, MUTATION_OUTPUT, `${report}-recent-killers.jsonl`);
    rmSync(into, { force: true });
    rmSync(recent, { force: true });
    process.env[KILLERS_VARIABLE] = into;
    process.env[RECENT_KILLERS_VARIABLE] = recent;
}
