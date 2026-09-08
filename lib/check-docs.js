#!/usr/bin/env node

/**
 * The shape of a repository's manual, read off the filesystem and judged by
 * `@jterrazz/typescript/docs`.
 *
 * Every repository carries the same `docs/`: a map, the fixed spine —
 * architecture, developing, testing, and operating when the repository ships
 * something that runs — and its own chapters numbered contiguously after it.
 * This file is the READER: it builds the plain tree the rule engine takes
 * (`src/docs.js`) and prints what comes back. Every sentence, every rule id and
 * the journal-word roster live in the engine, so a second reader — terra,
 * sweeping clones it never installed — judges by the same copy.
 *
 * Usage: node check-docs.js [root]
 *
 * One line per violation, `<rule>  <path>  <message>`. Exit code: 0 when the
 * repository holds the shape, 1 otherwise.
 *
 * The unit is the REPOSITORY, not the package: a manual answers for the whole
 * tree, and only the root carries the `AGENTS.md` that routes into it. The one
 * place the workspace shows through is the `04-operating.md` presence test,
 * whose Dockerfile and `.infrastructure/` clauses are read at the root AND at
 * every workspace member's root — a monorepo deploys from a member as readily
 * as from its root (ADR-007, the toolchain's unit is the workspace package).
 * The publishable clause stays on the ROOT manifest: a private root that holds
 * a publishable member is a question for its owner, not a verdict for a gate.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { auditDocs, HEAD_LINES } from '../src/docs.js';
import { workspaceMembers } from './workspace-members.js';

/** Every markdown link target of a page, in the order the page carries them. */
const LINK = /!?\[[^\]]*]\(\s*(?<target>[^\s)]+)/g;

/** Where a repository declares a deployment it owns. */
const INFRASTRUCTURE = '.infrastructure';

/**
 * Every path under `docs/`, repository-relative, directories carrying a
 * trailing slash. `docs/` itself is the first entry when it exists — its
 * absence is the whole verdict.
 */
function listDocs(root) {
    const paths = [];

    /** One directory, depth-first, sorted — a listing a machine can diff. */
    function walk(relativePath) {
        paths.push(`${relativePath}/`);

        const entries = readdirSync(join(root, relativePath), { withFileTypes: true });
        for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
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

/** A file's text, or null when it is not there — an unreadable file is an absent one. */
function read(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

/** The head and the links of every markdown page of the tree. */
function readPages(root, files) {
    const heads = {};
    const links = {};

    for (const path of files) {
        if (!path.endsWith('.md')) {
            continue;
        }

        const text = read(join(root, path)) ?? '';
        heads[path] = text.split('\n').slice(0, HEAD_LINES);
        links[path] = [...text.matchAll(LINK)].map((match) => match.groups.target);
    }

    return { heads, links };
}

/** A `Dockerfile`, or one of its variants, in a directory. */
function hasDockerfile(dir) {
    try {
        return readdirSync(dir).some(
            (name) => name === 'Dockerfile' || name.startsWith('Dockerfile.'),
        );
    } catch {
        return false;
    }
}

/** A manifest that npm would publish — one that never says it is private. */
function isPublishable(dir) {
    const manifest = read(join(dir, 'package.json'));
    if (manifest === null) {
        return false;
    }

    try {
        return JSON.parse(manifest).private !== true;
    } catch {
        return false;
    }
}

/** The three facts `04-operating.md` is asked for, read at the root and its members. */
function readShips(root) {
    const roots = [root, ...workspaceMembers(root).map((member) => join(root, member))];

    return {
        dockerfile: roots.some((dir) => hasDockerfile(dir)),
        infrastructure: roots.some((dir) => existsSync(join(dir, INFRASTRUCTURE))),
        publishable: isPublishable(root),
    };
}

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const files = listDocs(root);

const violations = auditDocs({
    agents: read(join(root, 'AGENTS.md')),
    files,
    ...readPages(root, files),
    ships: readShips(root),
});

for (const violation of violations) {
    stdout.write(`${violation.rule}  ${violation.path}  ${violation.message}\n`);
}

exit(violations.length > 0 ? 1 : 0);
