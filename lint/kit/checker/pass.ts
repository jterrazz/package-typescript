import type { Ratchet } from '../baseline/section.js';
import type { ChapterAnchor } from '../catalogue/lesson.js';
import type { BasePresets, Resolution } from '../project/preset.js';
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
    config: (unit?: string) => Promise<Resolution>;
    exists: (path: string) => boolean;
    files: () => string[];
    fix: boolean;
    has: CommandLine['has'];
    verbatim: () => Promise<string[]>;
    list: (directory: string) => null | string[];
    positionals: readonly string[];
    read: (path: string) => null | string;
    root: string;
    value: CommandLine['value'];
};

export type Tool = { args: string[]; flag: string; name: string };

export type PassResult = {
    after?: string[];
    deferred?: boolean;
    failed?: boolean;
    findings?: Finding[];
    json?: unknown;
    lines?: string[];
    tools?: Tool[];
    writes?: { path: string; text: string }[];
};

export type Removal = { directory: string; line: string };

export type Pass = {
    check: (context: Context) => PassResult | Promise<PassResult>;
    namespace?: string;
    prepare?: (context: Context) => Promise<{ removals?: Removal[] }> | { removals?: Removal[] };
    valued?: readonly string[];
};

export type Passes = Readonly<Record<string, () => Promise<Pass>>>;

export type HeldSection = Ratchet & { read: ChapterAnchor; section: string };

export type Held = HeldSection & { passes: readonly string[]; summarised?: boolean };

export type Commands = Readonly<Record<string, () => Promise<KitCommand>>>;

export type Checker = {
    commands?: Commands;
    held?: Held;
    passes: Passes;
    base: BasePresets;
};

export type Contribution = Omit<Checker, 'base'>;

export type KitCommand = (args: string[], checker: Checker) => number | Promise<number>;
