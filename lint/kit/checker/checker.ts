import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { invariant } from '../catalogue/lesson.js';
import { removeEmptyDirectory } from '../project/empty-directories.js';
import { readConfig } from '../project/jterrazz-config.js';
import type { BasePresets, Resolution } from '../project/preset.js';
import { orRefused, projectFiles } from '../project/project-files.js';
import { readCommandLine } from './command-line.js';
import type { CommandLine } from './command-line.js';
import { heldSummary, judgeHeld } from './held.js';
import { verbatimGlobsOf } from './kept-files.js';
import type {
    Checker,
    Context,
    Contribution,
    Finding,
    Pass,
    PassResult,
    Removal,
    Tool,
} from './pass.js';
import { reportLine } from './report-line.js';
import { runTool } from './tool-run.js';

type Run = { findings: Finding[]; result: PassResult };

function readAt(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

function listAt(directory: string): null | string[] {
    try {
        return readdirSync(directory);
    } catch {
        return null;
    }
}

export function contextOf(commandLine: CommandLine, base: BasePresets): Context {
    const root = resolve(commandLine.positionals[0] ?? '.');
    const configs = new Map<string, Promise<Resolution>>();
    let files: string[] | undefined;
    let verbatim: Promise<string[]> | undefined;
    const config = async (unit = root): Promise<Resolution> => {
        const known = configs.get(unit) ?? readConfig(unit, base);
        configs.set(unit, known);

        return await known;
    };

    return {
        config,
        exists: existsSync,
        files: () => (files ??= orRefused(() => projectFiles(root))),
        fix: commandLine.has('--fix'),
        has: commandLine.has,
        list: listAt,
        positionals: commandLine.positionals,
        read: readAt,
        root,
        value: commandLine.value,
        verbatim: async () => await (verbatim ??= verbatimGlobsOf({ config, root })),
    };
}

type Print = (lines: string[]) => void;

const print: Print = (lines) => {
    stdout.write(lines.map((line) => `${line}\n`).join(''));
};

function removeAll(context: Context, removals: readonly Removal[]): void {
    for (const { directory, line } of removals) {
        if (removeEmptyDirectory(context.root, directory)) {
            print([line]);
        }
    }
}

function runTools(context: Context, tools: readonly Tool[]): boolean {
    let failed = false;
    for (const { args, flag, name } of tools) {
        const { output, status } = runTool(name, context.value(flag, name), args, context.root);
        if (status !== 0) {
            stdout.write(output);
            failed = true;
        }
    }

    return failed;
}

const findingsJson = (findings: readonly Finding[]): string =>
    JSON.stringify(
        findings.map(({ column, line, message, path, rule }) => ({
            column: column ?? 1,
            line: line ?? 1,
            message,
            path,
            rule,
        })),
    );

function settled(context: Context, { findings, result }: Run): number {
    print(findings.map((finding) => reportLine(finding)));
    for (const { path, text } of result.writes ?? []) {
        writeFileSync(path, text);
    }
    print(result.after ?? []);
    const toolsFailed = runTools(context, result.tools ?? []);

    return findings.length > 0 || result.failed === true || toolsFailed ? 1 : 0;
}

type Verdict = {
    checker: Checker;
    context: Context;
    formatted: boolean;
    name: string;
    pass: Pass;
    run: Run;
};

function verdictOf({ checker, context, formatted, name, pass, run }: Verdict): number {
    const { findings, result } = run;
    const unsaid: string[] = [];
    const say: Print = formatted
        ? (lines) => {
              unsaid.push(...lines);
          }
        : print;
    say(result.lines ?? []);
    if (result.deferred === true) {
        say(findings.map((finding) => reportLine(finding)));

        return result.failed === true ? 1 : 0;
    }
    const { held } = checker;
    if (held === undefined || !held.passes.includes(name)) {
        return formatted ? Number(findings.length > 0) : settled(context, run);
    }
    const judged = judgeHeld({ ...run, context, held, name, pass, print: say });
    if (result.failed === true) {
        return 1;
    }
    if (judged === 0 && held.summarised === true) {
        say([heldSummary(context.root, held.section)]);
    }

    return judged;
}

async function runPass(
    { checker, name, pass }: { checker: Checker; name: string; pass: Pass },
    args: readonly string[],
): Promise<number> {
    const commandLine = readCommandLine(args, pass.valued);
    const context = contextOf(commandLine, checker.base);
    if (context.fix && pass.prepare !== undefined) {
        const prepared = await pass.prepare(context);
        removeAll(context, prepared.removals ?? []);
    }

    const result = await pass.check(context);
    const run: Run = {
        findings: (result.findings ?? []).filter(
            (finding) => !(context.fix && finding.fixed === true),
        ),
        result,
    };
    if (commandLine.has('--json')) {
        stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);

        return run.findings.length > 0 || result.failed === true ? 1 : 0;
    }
    const formatted = commandLine.has('--format');
    if (formatted && result.failed === true) {
        return 1;
    }
    if (formatted) {
        stdout.write(`${findingsJson(run.findings)}\n`);
    }

    return verdictOf({ checker, context, formatted, name, pass, run });
}

async function runEvery(checker: Checker, args: readonly string[]): Promise<number> {
    let status = 0;
    for (const [name, load] of Object.entries(checker.passes)) {
        const ran = await runPass({ checker, name, pass: await load() }, args);
        status = Math.max(status, ran);
    }

    return status;
}

const isContribution = (value: unknown): value is Contribution =>
    typeof value === 'object' &&
    value !== null &&
    'passes' in value &&
    typeof value.passes === 'object' &&
    value.passes !== null;

export async function runContribution(
    loaded: unknown,
    base: BasePresets,
    args: readonly string[],
): Promise<never> {
    const contribution =
        typeof loaded === 'object' && loaded !== null && 'default' in loaded
            ? loaded.default
            : undefined;
    if (!isContribution(contribution)) {
        throw invariant('a preset names a checker module whose default export holds no `passes`');
    }
    const checker = { ...contribution, base };
    const [name = '', ...rest] = args;
    const command = checker.commands?.[name];
    exit(
        command === undefined
            ? await runEvery(checker, args)
            : await (
                  await command()
              )(rest, checker),
    );
}

export async function runChecker(
    checker: Checker,
    args: readonly string[] = argv.slice(2),
): Promise<never> {
    const [name = '', ...rest] = args;
    const commands = checker.commands ?? {};
    const command = commands[name];
    if (command !== undefined) {
        const run = await command();
        exit(await run(rest, checker));
    }
    const load = checker.passes[name];
    if (load === undefined) {
        stdout.write(
            `the checker runs no pass named \`${name}\`; it runs ${[...Object.keys(commands), ...Object.keys(checker.passes)].toSorted().join(', ')}\n`,
        );
        exit(2);
    }

    exit(await runPass({ checker, name, pass: await load() }, rest));
}
