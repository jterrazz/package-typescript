import type { Config } from '../project/jterrazz-config.js';
import type { Preset } from '../project/preset.js';
import type { CommandLine } from './command-line.js';

export type Finding = {
    column?: number;
    fixed?: boolean;
    line?: number;
    message: string;
    path: string;
    rule: string;
};

export type Context = {
    config: (unit?: string) => Promise<Config>;
    exists: (path: string) => boolean;
    files: () => string[];
    fix: boolean;
    has: CommandLine['has'];
    ignorePatterns: string[];
    list: (directory: string) => null | string[];
    read: (path: string) => null | string;
    root: string;
    value: CommandLine['value'];
};

export type Tool = { args: string[]; flag: string; name: string };

export type PassResult = {
    after?: string[];
    failed?: boolean;
    findings?: Finding[];
    json?: unknown;
    lines?: string[];
    sourceLines?: number;
    tools?: Tool[];
    writes?: { path: string; text: string }[];
};

export type Removal = { directory: string; line: string };

export type Pass = {
    check: (context: Context) => PassResult | Promise<PassResult>;
    entry?: string;
    prepare?: (context: Context) => { removals?: Removal[] };
    valued?: readonly string[];
    verdict?: (count: number, recorded: number | undefined, result: PassResult) => string;
};

export type Passes = Readonly<Record<string, () => Promise<Pass>>>;

export type EngineCommand = (
    args: string[],
    options: { held: readonly string[] },
) => number | Promise<number>;

export type Checker = { held: readonly string[]; passes: Passes; presets: readonly Preset[] };
