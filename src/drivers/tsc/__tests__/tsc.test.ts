import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, test } from 'vitest';

import manifest from '../../../../package.json' with { type: 'json' };
import { tscBinary } from '../tsc.js';

describe('tsc', () => {
    test('tscBinary — the binary of the platform package the alias depends on, at the version the manifest pins', () => {
        // Given - this checkout's install, where the release it consumes of itself still pulls another TypeScript 7
        const binary = tscBinary();

        // Then - the path is a platform package's own binary, never a linked bin, and it runs the alias's version
        expect(binary).toMatch(
            new RegExp(`/@typescript/typescript-${process.platform}-${process.arch}/lib/tsc$`, 'u'),
        );
        expect(execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim()).toBe(
            `Version ${manifest.dependencies['@typescript/native'].replace(/^npm:[^@]+@/u, '')}`,
        );
    });
});
