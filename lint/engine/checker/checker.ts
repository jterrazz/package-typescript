import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { removeEmptyDirectory } from '../project/empty-directories.js';
import { readConfig } from '../project/jterrazz-config.js';
import type { Config } from '../project/jterrazz-config.js';
import type { Preset } from '../project/preset.js';
import { orRefused, projectFiles } from '../project/project-files.js';
import { readCommandLine } from './command-line.js';
import type { CommandLine } from './command-line.js';
import { judgeHeld } from './held.js';
import type { Checker, Context, Finding, Pass, PassResult, Removal, Tool } from './pass.js';
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

export function contextOf(commandLine: CommandLine, presets: readonly Preset[]): Context {
    const root = resolve(commandLine.positionals[0] ?? '.');
    const ignorePatterns = commandLine.values('--ignore-pattern');
    const configs = new Map<string, Promise<Config>>();
    let files: string[] | undefined;

    return {
        config: async (unit = root) => {
            const known = configs.get(unit) ?? readConfig(unit, presets);
            configs.set(unit, known);

            return await known;
        },
        exists: existsSync,
        files: () => (files ??= orRefused(() => projectFiles(root, { ignorePatterns }))),
        fix: commandLine.has('--fix'),
        has: commandLine.has,
        ignorePatterns,
        list: listAt,
        read: readAt,
        root,
        value: commandLine.value,
    };
}

const print = (lines: readonly string[]): void => {
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

function reported(commandLine: CommandLine, { findings, result }: Run): null | number {
    if (commandLine.has('--json')) {
        stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);

        return findings.length > 0 || result.failed === true ? 1 : 0;
    }
    if (commandLine.has('--format')) {
        if (result.failed === true) {
            return 1;
        }
        stdout.write(
            `${JSON.stringify(
                findings.map(({ column, line, message, path, rule }) => ({
                    column: column ?? 1,
                    line: line ?? 1,
                    message,
                    path,
                    rule,
                })),
            )}\n`,
        );

        return 0;
    }

    return null;
}

function settled(context: Context, { findings, result }: Run): number {
    print(findings.map((finding) => reportLine(finding)));
    for (const { path, text } of result.writes ?? []) {
        writeFileSync(path, text);
    }
    print(result.after ?? []);
    const toolsFailed = runTools(context, result.tools ?? []);

    return findings.length > 0 || result.failed === true || toolsFailed ? 1 : 0;
}

async function runPass(
    { checker, name, pass }: { checker: Checker; name: string; pass: Pass },
    args: readonly string[],
): Promise<number> {
    const commandLine = readCommandLine(args, pass.valued);
    const context = contextOf(commandLine, checker.presets);
    if (context.fix && pass.prepare !== undefined) {
        removeAll(context, pass.prepare(context).removals ?? []);
    }

    const result = await pass.check(context);
    const run: Run = {
        findings: (result.findings ?? []).filter(
            (finding) => !(context.fix && finding.fixed === true),
        ),
        result,
    };
    const verdict = reported(commandLine, run);
    if (verdict !== null) {
        return verdict;
    }

    print(result.lines ?? []);
    if (result.deferred === true) {
        print(run.findings.map((finding) => reportLine(finding)));

        return result.failed === true ? 1 : 0;
    }
    const { held } = checker;
    if (held === undefined || !held.passes.includes(name)) {
        return settled(context, run);
    }
    if (pass.entry === undefined) {
        print(run.findings.map((finding) => reportLine(finding)));
    }

    const judged = judgeHeld({ ...run, context, held, name, pass, print });

    return result.failed === true ? 1 : judged;
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
            `the checker runs no pass named \`${name}\` — it runs ${[...Object.keys(commands), ...Object.keys(checker.passes)].toSorted().join(', ')}\n`,
        );
        exit(2);
    }

    exit(await runPass({ checker, name, pass: await load() }, rest));
}
