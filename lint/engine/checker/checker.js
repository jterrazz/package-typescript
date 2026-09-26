import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { removeEmptyDirectory } from '../project/empty-directories.js';
import { orRefused, projectFiles } from '../project/project-files.js';
import { readCommandLine } from './command-line.js';
import { ENGINE_COMMANDS } from './engine-commands.js';
import { judgeHeld } from './held.js';
import { runTool } from './tool-run.js';

function readAt(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

function listAt(directory) {
    try {
        return readdirSync(directory);
    } catch {
        return null;
    }
}

function contextOf(commandLine) {
    const root = resolve(commandLine.positionals[0] ?? '.');
    const ignorePatterns = commandLine.values('--ignore-pattern');
    let files;

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

const print = (lines) => stdout.write(lines.map((line) => `${line}\n`).join(''));

const findingLine = ({ message, path, rule }) => `${rule}  ${path}  ${message}`;

function reportOf(name, findings) {
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

function removeAll(context, removals) {
    for (const { directory, line } of removals) {
        if (removeEmptyDirectory(context.root, directory)) {
            print([line]);
        }
    }
}

function runTools(context, tools) {
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

function reported(name, commandLine, { findings, result }) {
    if (commandLine.has('--json')) {
        stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);

        return findings.length > 0 || result.failed ? 1 : 0;
    }
    if (commandLine.has('--format')) {
        stdout.write(reportOf(name, findings));

        return 0;
    }
    const reportPath = commandLine.value('--report');
    if (reportPath !== undefined) {
        writeFileSync(reportPath, reportOf(name, findings));
    }

    return null;
}

function settled(context, { findings, result }) {
    print(findings.map((finding) => findingLine(finding)));
    for (const { path, text } of result.writes ?? []) {
        writeFileSync(path, text);
    }
    print(result.after ?? []);
    const toolsFailed = runTools(context, result.tools ?? []);

    return findings.length > 0 || result.failed || toolsFailed ? 1 : 0;
}

async function runPass(name, pass, args, held) {
    const commandLine = readCommandLine(args, pass.valued);
    const context = contextOf(commandLine);
    if (context.fix && pass.prepare !== undefined) {
        removeAll(context, pass.prepare(context).removals ?? []);
    }

    const result = await pass.check(context);
    const run = {
        findings: (result.findings ?? []).filter((finding) => !(context.fix && finding.fixed)),
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

    return judgeHeld({ ...run, context, name, pass, print });
}

export async function runChecker({ held, passes }, args = argv.slice(2)) {
    const [name, ...rest] = args;
    const command = ENGINE_COMMANDS[name];
    if (command !== undefined) {
        exit(await (await command())(rest, { held }));
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
