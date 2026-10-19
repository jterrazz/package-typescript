import type { ChapterAnchor } from '../../lint/kit/catalogue/lesson.js';

export type Flag = {
    name: `--${string}`;
    says: string;
    value?: `<${string}>`;
};

/** What one command reads from its command line, and the help it prints from that. */
export type Surface = {
    example?: string;
    flags?: readonly Flag[];
    forwards?: 'after-help' | 'everything';
    operand?: `<${string}>`;
    read: ChapterAnchor;
    says: string;
};

export const FORWARD_ALL = '--';

const QUALITY: ChapterAnchor = 'docs/reference/quality-checks.md#flags-and-exit-codes';

const BUILDING: ChapterAnchor = 'docs/reference/building.md#the-entries';

const GESTURES: ChapterAnchor = 'docs/guides/adopt-a-stricter-release.md#the-two-gestures';

export const SURFACES = {
    build: {
        flags: [{ name: '--watch', says: 'Rebuild on every change, and run nothing' }],
        read: BUILDING,
        says: 'Build the entries the manifest publishes, as its conditions ask',
    },
    start: { forwards: 'after-help', read: BUILDING, says: 'Run the built application' },
    dev: { read: BUILDING, says: 'Build, run, and rebuild on changes' },
    'docs-layout': {
        example: '.',
        operand: '<root>',
        read: 'docs/reference/quality-checks.md#outside-an-npm-project',
        says: "Check a repository's docs/ against the manual's shape",
    },
    doctor: {
        read: GESTURES,
        says: 'Report the installed tool versions against the declared ranges, and the file every setting comes from',
    },
    mutation: {
        flags: [
            {
                name: '--cold',
                says: 'Start both runs from no incremental report, as CI does: no verdict is inherited (TYPESCRIPT_MUTATION_COLD=1, or CI set, says the same)',
            },
            {
                name: '--mutate',
                says: 'Point both runs at these lines, every range in one comma-separated value: src/a.ts:10-20,src/b.ts:1-5',
                value: '<ranges>',
            },
            {
                name: '--since',
                says: 'Measure the change since this commit instead of the uncommitted change, or the branch since its merge-base on a clean tree',
                value: '<ref>',
            },
        ],
        read: 'docs/reference/quality-checks.md#mutation',
        says: 'Measure the suite against mutants of the sources (--mutate <ranges> narrows it)',
    },
    baseline: {
        read: GESTURES,
        says: "Record the debt: oxlint's in .jterrazz/oxlint-suppressions.json, the rest in .jterrazz/baseline.json",
    },
    tsc: {
        example: '--build',
        forwards: 'everything',
        read: 'docs/reference/building.md#tsc',
        says: 'Run the TypeScript 7 compiler this package ships (emit, --build)',
    },
    check: {
        flags: [
            { name: '--json', says: 'Print the drift report as one JSON object for a machine' },
        ],
        read: QUALITY,
        says: 'Check types, lint, formatting, and unused code',
    },
    fix: { read: QUALITY, says: 'Auto-fix lint and formatting issues' },
    'gate-lock': {
        read: 'docs/reference/quality-checks.md#one-gate-per-checkout',
        says: 'Refuse while a running gate holds this checkout, naming its pid: the guard an install or a pack runs first',
    },
    rehearse: {
        flags: [
            {
                name: '--branch',
                says: 'Rehearse this branch instead of the one checked out',
                value: '<name>',
            },
            {
                name: '--targets',
                says: `Run these make targets instead of \`build lint test\`, in one value: 'lint test'`,
                value: '<targets>',
            },
        ],
        read: 'docs/reference/commands.md#a-rehearsal-on-linux',
        says: 'Run the gate on Linux in Docker, on a fresh clone of the branch, as a GitHub runner runs it',
    },
    clean: {
        read: 'docs/start/getting-started.md#where-a-tools-output-goes',
        says: "Remove .artifacts/; dist/ stays, as the build's product",
    },
} as const satisfies Readonly<Record<string, Surface>>;

export type CommandName = keyof typeof SURFACES;

function synopsisOf(name: string, surface: Surface): string {
    const flags = (surface.flags ?? []).map(
        ({ name: flag, value }) => `[${flag}${value === undefined ? '' : ` ${value}`}]`,
    );
    const operand =
        surface.forwards === 'after-help'
            ? ['[<argument>...]']
            : surface.operand === undefined
              ? []
              : [`[${surface.operand}]`];

    return ['typescript', name, ...flags, ...operand].join(' ');
}

/** The help `typescript <name> --help` prints: the synopsis, what it does, each flag, and the page that owns it. */
export function helpOf(name: string, surface: Surface): string {
    const rows: [string, string][] = [
        ...(surface.flags ?? []).map(({ name: flag, says, value }): [string, string] => [
            value === undefined ? flag : `${flag} ${value}`,
            says,
        ]),
        ...(surface.forwards === 'after-help'
            ? [
                  [
                      '<argument>...',
                      `Handed to the application; after ${FORWARD_ALL}, every argument is, -h and --help included`,
                  ] satisfies [string, string],
              ]
            : []),
        ['-h, --help', 'Print this help and run nothing'],
    ];
    const width = Math.max(...rows.map(([left]) => left.length)) + 2;

    return [
        `Usage: ${synopsisOf(name, surface)}`,
        '',
        surface.says,
        '',
        'Flags:',
        ...rows.map(([left, says]) => `  ${left.padEnd(width)}${says}`),
        '',
        `Read: ${surface.read}`,
    ].join('\n');
}
