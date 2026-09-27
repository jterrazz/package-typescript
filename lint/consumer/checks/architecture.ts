import type { IRegularForbiddenRuleType } from 'dependency-cruiser';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Context, Finding, Pass } from '../../engine/checker/pass.js';
import { runTool } from '../../engine/checker/tool-run.js';
import { objectOf, stringOf } from '../../engine/project/json.js';
import { readSection } from '../../engine/project/jterrazz-config.js';
import { ARCHITECTURE_HEXAGONAL } from './architecture.hexagonal.js';

/** One boundary of a layer map: dependency-cruiser's `from` and `to`, and what a refusal teaches. */
export type ArchitectureRule = Pick<IRegularForbiddenRuleType, 'from' | 'to'> & {
    fix: string;
    name: string;
    read: string;
    why: string;
};

const OWN_CONFIGS = [
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.js',
    '.dependency-cruiser.mjs',
];

const CRUISED_ROOTS = ['src', 'lint', 'apps', 'packages', 'lib'];

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

async function declaredRules(root: string): Promise<Declared> {
    const { problem, section } = await readSection(root, 'typescript');
    const { architecture } = section;
    if (problem !== null || architecture === undefined) {
        return { problem, rules: [] };
    }
    const { hexagonal, layers = [] } = objectOf(architecture);
    if (!Array.isArray(layers) || !layers.every((layer) => isRule(layer))) {
        return {
            problem:
                'holds a `typescript.architecture.layers` whose every entry is not `{ name, from, to, why, fix, read }`',
            rules: [],
        };
    }

    return {
        problem: null,
        rules: [...(hexagonal === true ? ARCHITECTURE_HEXAGONAL : []), ...layers],
    };
}

function cruiseConfig(rules: readonly ArchitectureRule[], context: Context): unknown {
    const own = OWN_CONFIGS.find((name) => context.exists(join(context.root, name)));

    return {
        ...(own === undefined ? {} : { extends: join(context.root, own) }),
        forbidden: rules.map(({ from, name, to }) => ({ from, name, severity: 'error', to })),
        options: {
            doNotFollow: { path: 'node_modules' },
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
    return CRUISED_ROOTS.filter((name) => {
        try {
            return readdirSync(join(context.root, name)).length > 0;
        } catch {
            return false;
        }
    });
}

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

function cruised(
    context: Context,
    rules: readonly ArchitectureRule[],
): { findings: Finding[]; problem: null | string } {
    const roots = cruisedRoots(context);
    if (roots.length === 0) {
        return { findings: [], problem: null };
    }
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-architecture-'));
    try {
        const config = join(scratch, 'dependency-cruiser.json');
        writeFileSync(config, JSON.stringify(cruiseConfig(rules, context)));
        const { output, status } = runTool(
            'dependency-cruiser',
            context.value('--depcruise', 'depcruise'),
            ['--config', config, '--output-type', 'json', ...roots],
            context.root,
        );
        let report: unknown;
        try {
            report = JSON.parse(output);
        } catch {
            return { findings: [], problem: status === 0 ? null : output };
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
            return { failed: true, lines: [`jterrazz.config.ts ${problem}`] };
        }
        const own = OWN_CONFIGS.some((name) => context.exists(join(context.root, name)));
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
