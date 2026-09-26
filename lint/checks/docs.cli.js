#!/usr/bin/env node

// Only the reader: every sentence and rule id lives in `docs.js`, so terra judges by the same copy.
// The Dockerfile and `.infrastructure/` clauses are read at every member's root too; the publishable
// clause stays on the root manifest.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { workspaceMembers } from '../reading/workspace-members.js';
import { auditDocs, HEAD_LINES } from './docs.js';

const LINK = /!?\[[^\]]*\]\(\s*(?<target>[^\s)]+)/gu;

const INFRASTRUCTURE = '.infrastructure';

// `docs/` itself is the first entry when it exists — its absence is the whole verdict.
function listDocs(root) {
    const paths = [];

    function walk(relativePath) {
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

// An unreadable file is an absent one.
function read(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

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

function hasDockerfile(dir) {
    try {
        return readdirSync(dir).some(
            (name) => name === 'Dockerfile' || name.startsWith('Dockerfile.'),
        );
    } catch {
        return false;
    }
}

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
