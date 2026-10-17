import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { refusal } from '../../kit/catalogue/lesson.js';
import type { ChapterAnchor } from '../../kit/catalogue/lesson.js';
import { defineCheck } from '../../kit/catalogue/rule.js';
import type { Context, Finding, Pass } from '../../kit/checker/pass.js';
import { runTool } from '../../kit/checker/tool-run.js';
import type { ToolRun } from '../../kit/checker/tool-run.js';
import { UNCRUISED_PATHS } from '../../kit/project/ground.js';
import { isInert } from '../../kit/project/inert-laws.js';
import { isJsonObject, listOf, objectOf, textOf } from '../../kit/project/json.js';
import { DEPENDENCY_CRUISER_CONFIGS, SETTINGS_FILE } from '../../kit/project/jterrazz-config.js';
import { isChapterAnchor, presetLesson } from '../../kit/project/preset.js';
import type { ArchitectureRule } from '../../kit/project/preset.js';
import { hexagonalMapOf } from './architecture.hexagonal.js';

const SOURCE = /\.[cm]?[jt]sx?$/u;

const TSCONFIG = 'tsconfig.json';

const OWN_FIX =
    'reach it through a layer the map allows, or change the map where the boundary moved';

const OWN_READ: ChapterAnchor = 'docs/reference/quality-checks.md#the-architecture-layer-map-pass';

type Declared = { problem: null; rules: ArchitectureRule[] } | { problem: string };

type Violation = { from: string; rule: string; to: string };

type Lesson = Pick<ArchitectureRule, 'fix' | 'read' | 'why'>;

function isRule(value: unknown): value is ArchitectureRule {
    return (
        isJsonObject(value) &&
        ['fix', 'name', 'why'].every((key) => typeof value[key] === 'string') &&
        isChapterAnchor(value.read) &&
        isJsonObject(value.from) &&
        isJsonObject(value.to)
    );
}

const MALFORMED_LAYERS = refusal({
    fix: "give every entry of `typescript.architecture.layers`, and of each preset's `layers`, a `name`, a `from` and a `to` object, and a `why`, a `fix` and a `read`",
    found: 'jterrazz.config.ts holds a `layers` whose every entry is not `{ name, from, to, why, fix, read }`, `read` a chapter anchor `docs/<chapter>.md#<heading>`',
    read: 'docs/reference/quality-checks.md#the-architecture-layer-map-pass',
    why: 'a layer is a dependency-cruiser rule and the lesson its refusal prints, and a layer missing a part can be neither judged nor taught',
});

async function declaredRules(context: Context): Promise<Declared> {
    const { problem, resolved } = await context.config();
    if (problem !== null) {
        return {
            problem: refusal({
                ...presetLesson(problem, SETTINGS_FILE),
                read: 'docs/reference/configuration.md#the-merge-order',
            }),
        };
    }
    if (!resolved.layers.every((layer) => isRule(layer))) {
        return { problem: MALFORMED_LAYERS };
    }
    const architecture = objectOf(objectOf(resolved.sections.typescript).architecture);
    const holds = (folder: string): boolean => context.exists(join(context.root, folder));

    return {
        problem: null,
        rules: [
            ...hexagonalMapOf(architecture.hexagonal, {
                platform: resolved.declaration?.platform ?? null,
                unit: context.root,
            }),
            ...resolved.layers,
        ].filter((rule) => !isInert(rule, holds)),
    };
}

function cruiseConfig(rules: readonly ArchitectureRule[], context: Context): unknown {
    const own = DEPENDENCY_CRUISER_CONFIGS.find((name) => context.exists(join(context.root, name)));

    return {
        ...(own === undefined ? {} : { extends: join(context.root, own) }),
        forbidden: rules.map(({ from, name, to }) => ({ from, name, severity: 'error', to })),
        options: {
            doNotFollow: { path: 'node_modules' },
            exclude: { path: UNCRUISED_PATHS },
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
    read: 'docs/reference/quality-checks.md#the-architecture-layer-map-pass',
    why: 'a map with nothing to cruise judges no import, and its silence would read as every boundary kept',
});

type Cruise = {
    comments: Map<string, string>;
    specifiers: Map<string, string>;
    violations: Violation[];
};

function violationsOf(report: unknown): Cruise {
    const specifiers = new Map<string, string>();
    for (const module of listOf(objectOf(report).modules)) {
        const { dependencies, source } = objectOf(module);
        for (const dependency of listOf(dependencies)) {
            const { module: specifier, resolved } = objectOf(dependency);
            specifiers.set(`${textOf(source)} ${textOf(resolved)}`, textOf(specifier));
        }
    }
    const summary = objectOf(objectOf(report).summary);
    const comments = new Map(
        listOf(objectOf(summary.ruleSetUsed).forbidden).map((rule) => {
            const { comment, name } = objectOf(rule);

            return [textOf(name), textOf(comment)];
        }),
    );
    const violations = listOf(summary.violations).map((entry) => {
        const { from, rule, to } = objectOf(entry);

        return { from: textOf(from), rule: textOf(objectOf(rule).name), to: textOf(to) };
    });

    return { comments, specifiers, violations };
}

function positionOf(text: string, specifier: string | undefined): { column: number; line: number } {
    if (specifier === undefined) {
        return { column: 1, line: 1 };
    }
    const at = ["'", '"', '`']
        .map((quote) => text.indexOf(`${quote}${specifier}${quote}`))
        .filter((index) => index !== -1)
        .toSorted((left, right) => left - right)[0];
    if (at === undefined) {
        return { column: 1, line: 1 };
    }
    const before = text.slice(0, at + 1);

    return {
        column: before.length - (before.lastIndexOf('\n') + 1),
        line: before.split('\n').length,
    };
}

function findingOf(
    context: Context,
    { from, rule, to }: Violation,
    { lesson, specifier }: { lesson: Lesson | undefined; specifier: string | undefined },
): Finding {
    const why = lesson?.why ?? "the project's dependency-cruiser config forbids it";
    const check = defineCheck({
        docs: { name: rule, sentence: why, why },
        namespace: 'architecture',
        read: lesson?.read ?? OWN_READ,
    });
    // Stryker disable next-line StringLiteral: a text that names no specifier puts the finding at the top of the file, as no text does
    const text = context.read(join(context.root, from)) ?? '';

    return check.finding(
        { ...positionOf(text, specifier), path: from },
        { fix: lesson?.fix ?? OWN_FIX, found: `\`${from}\` imports \`${to}\`` },
    );
}

function unreportedOf({ output, ran, status }: ToolRun): null | string {
    if (!ran) {
        return output.trim();
    }

    return status === 0
        ? null
        : refusal({
              fix: 'correct what dependency-cruiser printed (a layer whose `from` or `to` it cannot read, a tsconfig it cannot load), then run again',
              found: `dependency-cruiser stopped with no report: ${output.trim()}`,
              read: 'docs/reference/quality-checks.md#the-architecture-layer-map-pass',
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
            // Stryker disable next-line StringLiteral: JSON.parse reads a buffer as its text
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
                    specifier: specifiers.get(`${violation.from} ${violation.to}`),
                }),
            ),
            problem: null,
        };
    } finally {
        // Stryker disable next-line BooleanLiteral: the scratch folder was made above and is still there, which `force` only forgives the absence of
        rmSync(scratch, { force: true, recursive: true });
    }
}

export const architecture: Pass = Object.freeze({
    async check(context) {
        const declared = await declaredRules(context);
        if (declared.problem !== null) {
            return { failed: true, lines: [declared.problem] };
        }
        const { rules } = declared;
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
