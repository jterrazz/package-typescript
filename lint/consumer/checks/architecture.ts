import type { IRegularForbiddenRuleType } from 'dependency-cruiser';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { refusal } from '../../engine/catalogue/lesson.js';
import type { Context, Finding, Pass } from '../../engine/checker/pass.js';
import { runTool } from '../../engine/checker/tool-run.js';
import type { ToolRun } from '../../engine/checker/tool-run.js';
import { GROUND_FOLDERS } from '../../engine/project/ground.js';
import { objectOf, stringOf } from '../../engine/project/json.js';
import {
    declaredUnder,
    DEPENDENCY_CRUISER_CONFIGS,
    readSection,
} from '../../engine/project/jterrazz-config.js';
import { ARCHITECTURE_HEXAGONAL } from './architecture.hexagonal.js';

/** One boundary of a layer map: dependency-cruiser's `from` and `to`, and what a refusal teaches. */
export type ArchitectureRule = Pick<IRegularForbiddenRuleType, 'from' | 'to'> & {
    fix: string;
    name: string;
    read: string;
    why: string;
};

const SOURCE = /\.[cm]?[jt]sx?$/u;

const GROUND = `(^|/)(${GROUND_FOLDERS.join('|')})/`;

const TSCONFIG = 'tsconfig.json';

const OWN_FIX =
    'reach it through a layer the map allows, or change the map where the boundary moved';

const OWN_READ = 'docs/06-quality-checks.md#the-architecture-layer-map-pass';

type Declared = { problem: null | string; rules: ArchitectureRule[] };

type Violation = { from: string; rule: string; to: string };

type Lesson = Pick<ArchitectureRule, 'fix' | 'read' | 'why'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

function isRule(value: unknown): value is ArchitectureRule {
    return (
        isRecord(value) &&
        ['fix', 'name', 'read', 'why'].every((key) => typeof value[key] === 'string') &&
        isRecord(value.from) &&
        isRecord(value.to)
    );
}

const MALFORMED_LAYERS = refusal({
    fix: "give every entry of `typescript.architecture.layers` — and of each preset's `architecture.layers` — a `name`, a `from` and a `to` object, and a `why`, a `fix` and a `read`",
    found: 'jterrazz.config.ts holds a `layers` whose every entry is not `{ name, from, to, why, fix, read }`',
    read: 'docs/06-quality-checks.md#the-architecture-layer-map-pass',
    why: 'a layer is a dependency-cruiser rule and the lesson its refusal prints, and a layer missing a part can be neither judged nor taught',
});

function unreadable(problem: string): Declared {
    return {
        problem: refusal({
            fix: 'correct jterrazz.config.ts until it loads and its `typescript` section has the declared shape, then run again',
            found: `jterrazz.config.ts ${problem}`,
            read: 'docs/06-quality-checks.md#the-architecture-layer-map-pass',
            why: 'the layer map is read from that file, and a map that cannot be read judges no import',
        }),
        rules: [],
    };
}

async function declaredRules(root: string): Promise<Declared> {
    const { problem, section } = await readSection(root, 'typescript');
    if (problem !== null) {
        return unreadable(problem);
    }
    const { declared, problem: presets } = declaredUnder(section, 'architecture');
    if (presets !== null) {
        return unreadable(presets);
    }
    const rules: ArchitectureRule[] = [];
    let hexagonal = false;
    for (const architecture of declared) {
        const { hexagonal: shipped, layers = [] } = objectOf(architecture);
        if (!Array.isArray(layers) || !layers.every((layer) => isRule(layer))) {
            return { problem: MALFORMED_LAYERS, rules: [] };
        }
        hexagonal ||= shipped === true;
        rules.push(...layers);
    }

    return { problem: null, rules: [...(hexagonal ? ARCHITECTURE_HEXAGONAL : []), ...rules] };
}

function cruiseConfig(rules: readonly ArchitectureRule[], context: Context): unknown {
    const own = DEPENDENCY_CRUISER_CONFIGS.find((name) => context.exists(join(context.root, name)));

    return {
        ...(own === undefined ? {} : { extends: join(context.root, own) }),
        forbidden: rules.map(({ from, name, to }) => ({ from, name, severity: 'error', to })),
        options: {
            doNotFollow: { path: 'node_modules' },
            exclude: { path: GROUND },
            enhancedResolveOptions: {
                conditionNames: ['import', 'require', 'node', 'default', 'types'],
                exportsFields: ['exports'],
            },
            tsPreCompilationDeps: true,
            ...(context.exists(join(context.root, TSCONFIG))
                ? { tsConfig: { fileName: join(context.root, TSCONFIG) } }
                : {}),
        },
    };
}

function cruisedRoots(context: Context): string[] {
    const folders = context
        .files()
        .filter((path) => SOURCE.test(path) && path.includes('/'))
        .map((path) => path.slice(0, path.indexOf('/')))
        .filter((folder) => !folder.startsWith('.'));

    return [...new Set(folders)].toSorted();
}

const UNCRUISED = refusal({
    fix: 'move the source into a folder, or remove the map that has nothing to judge',
    found: 'a layer map is declared, but no folder of the project holds a source file for it to cruise',
    read: 'docs/06-quality-checks.md#the-architecture-layer-map-pass',
    why: 'a map with nothing to cruise judges no import, and its silence would read as every boundary kept',
});

type Cruise = {
    comments: Map<string, string>;
    specifiers: Map<string, string>;
    violations: Violation[];
};

function violationsOf(report: unknown): Cruise {
    const specifiers = new Map<string, string>();
    const { modules } = objectOf(report);
    for (const module of Array.isArray(modules) ? modules : []) {
        const { dependencies, source } = objectOf(module);
        for (const dependency of Array.isArray(dependencies) ? dependencies : []) {
            const { module: specifier, resolved } = objectOf(dependency);
            specifiers.set(
                `${stringOf(source) ?? ''} ${stringOf(resolved) ?? ''}`,
                stringOf(specifier) ?? '',
            );
        }
    }
    const summary = objectOf(objectOf(report).summary);
    const used = objectOf(summary.ruleSetUsed).forbidden;
    const comments = new Map(
        (Array.isArray(used) ? used : []).map((rule) => {
            const { comment, name } = objectOf(rule);

            return [stringOf(name) ?? '', stringOf(comment) ?? ''];
        }),
    );
    const listed = summary.violations;
    const violations = (Array.isArray(listed) ? listed : []).map((entry) => {
        const { from, rule, to } = objectOf(entry);

        return {
            from: stringOf(from) ?? '',
            rule: stringOf(objectOf(rule).name) ?? '',
            to: stringOf(to) ?? '',
        };
    });

    return { comments, specifiers, violations };
}

function positionOf(text: string, specifier: string): string {
    const at = ["'", '"', '`']
        .map((quote) => text.indexOf(`${quote}${specifier}${quote}`))
        .filter((index) => index !== -1)
        .toSorted((left, right) => left - right)[0];
    if (at === undefined) {
        return '1:1';
    }
    const before = text.slice(0, at + 1).split('\n');

    return `${String(before.length)}:${String((before.at(-1) ?? '').length)}`;
}

function findingOf(
    context: Context,
    { from, rule, to }: Violation,
    { lesson, specifier }: { lesson: Lesson | undefined; specifier: string },
): Finding {
    const text = context.read(join(context.root, from)) ?? '';

    return {
        message: [
            `found: \`${from}\` imports \`${to}\``,
            `why: ${lesson?.why ?? "the project's dependency-cruiser config forbids it"}`,
            `fix: ${lesson?.fix ?? OWN_FIX}`,
            `read: ${lesson?.read ?? OWN_READ}`,
        ].join(' · '),
        path: `${from}:${positionOf(text, specifier)}`,
        rule: `architecture/${rule}`,
    };
}

function unreportedOf({ output, ran, status }: ToolRun): null | string {
    if (!ran) {
        return output.trim();
    }

    return status === 0
        ? null
        : refusal({
              fix: 'correct what dependency-cruiser printed — a layer whose `from` or `to` it cannot read, a tsconfig it cannot load — then run again',
              found: `dependency-cruiser stopped with no report — ${output.trim()}`,
              read: 'docs/06-quality-checks.md#the-architecture-layer-map-pass',
              why: 'the layer map is judged on the graph dependency-cruiser writes, and with no graph no import is judged',
          });
}

function cruised(
    context: Context,
    rules: readonly ArchitectureRule[],
): { findings: Finding[]; problem: null | string } {
    const roots = cruisedRoots(context);
    if (roots.length === 0) {
        return { findings: [], problem: UNCRUISED };
    }
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-architecture-'));
    try {
        const config = join(scratch, 'dependency-cruiser.json');
        const cruise = join(scratch, 'cruise.json');
        writeFileSync(config, JSON.stringify(cruiseConfig(rules, context)));
        const run = runTool(
            'dependency-cruiser',
            context.value('--depcruise', 'depcruise'),
            ['--config', config, '--output-type', 'json', '--output-to', cruise, ...roots],
            context.root,
        );
        let report: unknown;
        try {
            report = JSON.parse(readFileSync(cruise, 'utf8'));
        } catch {
            return { findings: [], problem: unreportedOf(run) };
        }
        const { comments, specifiers, violations } = violationsOf(report);
        const lessons = new Map<string, Lesson>(rules.map((rule) => [rule.name, rule]));
        for (const [name, comment] of comments) {
            if (!lessons.has(name) && comment !== '') {
                lessons.set(name, { fix: OWN_FIX, read: OWN_READ, why: comment });
            }
        }

        return {
            findings: violations.map((violation) =>
                findingOf(context, violation, {
                    lesson: lessons.get(violation.rule),
                    specifier: specifiers.get(`${violation.from} ${violation.to}`) ?? '',
                }),
            ),
            problem: null,
        };
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}

export const architecture: Pass = Object.freeze({
    async check(context) {
        const { problem, rules } = await declaredRules(context.root);
        if (problem !== null) {
            return { failed: true, lines: [problem] };
        }
        const own = DEPENDENCY_CRUISER_CONFIGS.some((name) =>
            context.exists(join(context.root, name)),
        );
        if (rules.length === 0 && !own) {
            return {};
        }
        const run = cruised(context, rules);

        return {
            ...(run.problem === null ? {} : { failed: true, lines: [run.problem] }),
            findings: run.findings,
        };
    },
    valued: ['--depcruise'],
});
