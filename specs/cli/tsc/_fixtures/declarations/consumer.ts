import presets from '@jterrazz/typescript';
import { defineConfig, definePreset, typescript } from '@jterrazz/typescript/config';
import type { JterrazzConfig } from '@jterrazz/typescript/config';
import { auditDocs } from '@jterrazz/typescript/docs';
import { base, defineConfig as defineFormat } from '@jterrazz/typescript/oxfmt';
import type { OxfmtConfig } from '@jterrazz/typescript/oxfmt';
import { compose, defineConfig as defineLint, nested, node } from '@jterrazz/typescript/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import { refusal } from '@jterrazz/typescript/rules';
import build from '@jterrazz/typescript/tsdown/build';

declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- an augmentation merges into an interface only; a type alias would redeclare the name
    interface JterrazzConfig {
        sibling?: { readonly strict: boolean };
    }
}

export const settings: JterrazzConfig = defineConfig({
    presets: [typescript({ profile: 'node' })],
    sibling: { strict: true },
    typescript: { roots: { scripts: 'the release scripts the CI workflow runs' } },
});

// @ts-expect-error — a root maps to the reason the repository keeps it
export const rootWithNoReason = defineConfig({ typescript: { roots: { scripts: true } } });

// @ts-expect-error — no package of the family declares an `unknown` section
export const undeclaredSection = defineConfig({ unknown: {} });

// @ts-expect-error — a preset is named for the package that ships it
export const namelessPreset = definePreset({ layers: [] });

export const lint: OxlintConfig = defineLint(compose(node, nested(presets.oxlint.node)));

export const format: OxfmtConfig = defineFormat({ ...base, ...presets.oxfmt });

// @ts-expect-error — oxfmt's own options are typed: a width is a number
export const wrongWidth = defineFormat({ printWidth: 'wide' });

export const message: string = refusal({
    fix: 'name the reason',
    found: 'a root with no reason',
    read: 'docs/roots.md#reasons',
    why: 'a root is kept for a reason',
});

// @ts-expect-error — a refusal names its four parts, and reads a chapter of a manual
export const readOutsideManual = refusal({ fix: 'f', found: 'x', read: 'https://example.com', why: 'y' });

export const audit: typeof auditDocs = auditDocs;

export const bundled = build;
