// invariant: the Dockerfile and `.infrastructure/` clauses are read at every member's root too; the publishable
// clause is the caller's, from the root's declared kind and every member's.

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceMembers } from './workspace-members.js';

/** The `docs/` tree of one repository, as a rule of the kit needs to see it. */
export type DocsTree = {
    /** The root `CLAUDE.md`, its whole text, or `null` when the repository has none as a regular file. */
    readonly brief: null | string;
    /** Every path under `docs/`, sorted, a directory with its trailing slash, `docs/` itself included. */
    readonly files: readonly string[];
    /** The first `HEAD_LINES` of every markdown file under `docs/`; no rule reads further down. */
    readonly heads: Readonly<Record<string, readonly string[]>>;
    /** Every markdown link target of each file under `docs/`, in the order the page carries them. */
    readonly links: Readonly<Record<string, readonly string[]>>;
    /** Whether a root `AGENTS.md` (a file or a link) is left over from the brief's old name. */
    readonly staleBrief: boolean;
    /** The three facts the `guides/release.md` presence test is derived from. */
    readonly ships: {
        /** A `Dockerfile` at the repository root or at a workspace member's. */
        readonly dockerfile: boolean;
        /** An `.infrastructure/` directory at either. */
        readonly infrastructure: boolean;
        /** A root that declares a kind npm publishes: a library or a cli. */
        readonly publishable: boolean;
    };
};

const LINK = /!?\[[^\]]*\]\(\s*(?<target>[^\s)]+)/gu;

const INFRASTRUCTURE = '.infrastructure';

// invariant: `docs/` itself is the first entry when it exists; its absence is the whole verdict.
function listDocs(root: string): string[] {
    const paths: string[] = [];

    function walk(relativePath: string): void {
        paths.push(`${relativePath}/`);

        const entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        for (const entry of entries.toSorted((a, b) => (a.name < b.name ? -1 : 1))) {
            const child = `${relativePath}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(child);
            } else {
                paths.push(child);
            }
        }
    }

    if (existsSync(join(root, 'docs'))) {
        walk('docs');
    }

    return paths;
}

// invariant: an unreadable file is an absent one.
// invariant: a link is no brief: CLAUDE.md is the file the agent reads, not a pointer to another name.
function readBrief(path: string): null | string {
    try {
        return lstatSync(path).isFile() ? readFileSync(path, 'utf8') : null;
    } catch {
        return null;
    }
}

function present(path: string): boolean {
    try {
        lstatSync(path);
        return true;
    } catch {
        return false;
    }
}

function read(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

function readPages(
    root: string,
    files: readonly string[],
    headLines: number,
): Pick<DocsTree, 'heads' | 'links'> {
    const heads: Record<string, string[]> = {};
    const links: Record<string, string[]> = {};

    for (const path of files) {
        if (!path.endsWith('.md')) {
            continue;
        }

        const text = read(join(root, path)) ?? '';
        heads[path] = text.split('\n').slice(0, headLines);
        links[path] = [...text.matchAll(LINK)].map((match) => match.groups?.target ?? '');
    }

    return { heads, links };
}

function hasDockerfile(dir: string): boolean {
    try {
        return readdirSync(dir).some(
            (name) => name === 'Dockerfile' || name.startsWith('Dockerfile.'),
        );
    } catch {
        return false;
    }
}

function readShips(root: string, publishable: boolean): DocsTree['ships'] {
    const roots = [root, ...workspaceMembers(root).map((member) => join(root, member))];

    return {
        dockerfile: roots.some((dir) => hasDockerfile(dir)),
        infrastructure: roots.some((dir) => existsSync(join(dir, INFRASTRUCTURE))),
        publishable,
    };
}

export function readDocsTree(
    root: string,
    { headLines, publishable }: { headLines: number; publishable: boolean },
): DocsTree {
    const files = listDocs(root);

    return {
        brief: readBrief(join(root, 'CLAUDE.md')),
        files,
        ...readPages(root, files, headLines),
        ships: readShips(root, publishable),
        staleBrief: present(join(root, 'AGENTS.md')),
    };
}
