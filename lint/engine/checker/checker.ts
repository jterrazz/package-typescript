import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { removeEmptyDirectory } from '../project/empty-directories.js';
import { orRefused, projectFiles } from '../project/project-files.js';
import { readCommandLine } from './command-line.js';
import type { CommandLine } from './command-line.js';
import { ENGINE_COMMANDS } from './engine-commands.js';
import { judgeHeld } from './held.js';
import type { Context, Finding, Pass, Passes, PassResult, Removal, Tool } from './pass.js';
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

function contextOf(commandLine: CommandLine): Context {
    const root = resolve(commandLine.positionals[0] ?? '.');
    const ignorePatterns = commandLine.values('--ignore-pattern');
    let files: string[] | undefined;

    return {
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

const findingLine = ({ message, path, rule }: Finding): string => `${rule}  ${path}  ${message}`;

function reportOf(name: string, findings: readonly Finding[]): string {
    const namespace = `${name}/`;

    return `${JSON.stringify({
        diagnostics: findings.map(({ line, message, path, rule }) => ({
            code: `${name}(${rule.slice(namespace.length)})`,
            filename: path,
            ...(line === undefined ? {} : { line }),
            message,
            severity: 'error',
        })),
    })}\n`;
}

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

function reported(
    name: string,
    commandLine: CommandLine,
    { findings, result }: Run,
): null | number {
    if (commandLine.has('--json')) {
        stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);

        return findings.length > 0 || result.failed === true ? 1 : 0;
    }
    if (commandLine.has('--format')) {
        if (result.failed === true) {
            return 1;
        }
        stdout.write(reportOf(name, findings));

        return 0;
    }
    const reportPath = commandLine.value('--report');
    if (reportPath !== undefined) {
        writeFileSync(reportPath, reportOf(name, findings));
    }

    return null;
}

function settled(context: Context, { findings, result }: Run): number {
    print(findings.map((finding) => findingLine(finding)));
    for (const { path, text } of result.writes ?? []) {
        writeFileSync(path, text);
    }
    print(result.after ?? []);
    const toolsFailed = runTools(context, result.tools ?? []);

    return findings.length > 0 || result.failed === true || toolsFailed ? 1 : 0;
}

async function runPass(
    name: string,
    pass: Pass,
    args: readonly string[],
    held: readonly string[],
): Promise<number> {
    const commandLine = readCommandLine(args, pass.valued);
    const context = contextOf(commandLine);
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
    const verdict = reported(name, commandLine, run);
    if (verdict !== null) {
        return verdict;
    }

    print(result.lines ?? []);
    if (!held.includes(name)) {
        return settled(context, run);
    }
    if (pass.entry === undefined) {
        print(run.findings.map((finding) => findingLine(finding)));
    }

    const judged = judgeHeld({ ...run, context, name, pass, print });

    return result.failed === true ? 1 : judged;
}

export async function runChecker(
    { held, passes }: { held: readonly string[]; passes: Passes },
    args: readonly string[] = argv.slice(2),
): Promise<never> {
    const [name = '', ...rest] = args;
    const command = ENGINE_COMMANDS[name];
    if (command !== undefined) {
        const run = await command();
        exit(await run(rest, { held }));
    }
    const load = passes[name];
    if (load === undefined) {
        stdout.write(
            `the checker runs no pass named \`${name}\` — it runs ${[...Object.keys(ENGINE_COMMANDS), ...Object.keys(passes)].toSorted().join(', ')}\n`,
        );
        exit(2);
    }

    exit(await runPass(name, await load(), rest, held));
}
