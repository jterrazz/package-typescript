import { defineConfig, definePreset } from '@jterrazz/typescript/config';
import type { JterrazzConfig } from '@jterrazz/typescript/config';
import { auditDocs } from '@jterrazz/typescript/docs';
import { oxfmtConfig } from '@jterrazz/typescript/oxfmt';
import type { OxfmtConfig } from '@jterrazz/typescript/oxfmt';
import { oxlintConfig } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import { refusal } from '@jterrazz/typescript/rules';

declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- an augmentation merges into an interface only; a type alias would redeclare the name
    interface JterrazzConfig {
        sibling?: { readonly strict: boolean };
    }
}

export const settings: JterrazzConfig = defineConfig({
    kind: 'cli',
    platform: 'node',
    sibling: { strict: true },
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});

export const workspace = defineConfig({ kind: 'workspace' });

// @ts-expect-error — a project declares what it is
export const undeclared = defineConfig({});

// @ts-expect-error — an api runs on node or bun, never in a browser
export const apiInABrowser = defineConfig({ kind: 'api', platform: 'react' });

// @ts-expect-error — a workspace's members each declare their own platform
export const platformedWorkspace = defineConfig({ kind: 'workspace', platform: 'node' });

// @ts-expect-error — a root maps to the reason the repository keeps it
export const rootWithNoReason = defineConfig({ kind: 'library', platform: 'node', typescript: { roots: { scripts: true } } });

// @ts-expect-error — no package of the family declares an `unknown` section
export const undeclaredSection = defineConfig({ kind: 'library', platform: 'node', unknown: {} });

// @ts-expect-error — a preset is named for the package that ships it
export const namelessPreset = definePreset({ layers: [] });

export const derivedLint: OxlintConfig = await oxlintConfig(import.meta.dirname);

export const derivedFormat: OxfmtConfig = await oxfmtConfig(import.meta.dirname);

export const message: string = refusal({
    fix: 'name the reason',
    found: 'a root with no reason',
    read: 'docs/roots.md#reasons',
    why: 'a root is kept for a reason',
});

// @ts-expect-error — a refusal names its four parts, and reads a chapter of a manual
export const readOutsideManual = refusal({ fix: 'f', found: 'x', read: 'https://example.com', why: 'y' });

export const audit: typeof auditDocs = auditDocs;
