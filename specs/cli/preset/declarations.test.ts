import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

/*
 * The one thing this package's "no build step" gives up: nothing derives a
 * `.d.ts` from its `.js`, so the two are written by hand beside each other and
 * nothing but this suite holds them to the same surface. A declaration that
 * names an export the runtime does not have is a consumer's compile error
 * against a value that is not there; one that misses an export the runtime has
 * makes a documented entry invisible to TypeScript.
 *
 * Types are not the claim — `OxlintConfig`, `DocsTree` and the rest exist in
 * the declaration alone by design. What must agree is the VALUE surface.
 */

const ROOT = resolve(import.meta.dirname, '../../../src');

/** The four importable entries, each a `.js` and the `.d.ts` written beside it. */
const ENTRIES = ['docs', 'index', 'oxfmt', 'oxlint'] as const;

/** Names in one order, so two readings of the same surface are comparable. */
const sorted = (names: string[]): string[] =>
    names.toSorted((left, right) => left.localeCompare(right));

/** Every value a declaration file exports, types and interfaces left out. */
function declaredValues(declaration: string): string[] {
    const program = ts.createProgram([declaration], {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        strict: true,
    });
    const source = program.getSourceFile(declaration);
    if (source === undefined) {
        throw new Error(`${declaration} does not parse`);
    }

    const checker = program.getTypeChecker();
    const module = checker.getSymbolAtLocation(source);
    if (module === undefined) {
        throw new Error(`${declaration} is not a module`);
    }

    return sorted(
        checker
            .getExportsOfModule(module)
            .filter((symbol) => carriesValue(checker, symbol))
            .map((symbol) => symbol.name),
    );
}

/**
 * Whether an exported name carries a value. `export { astro }`,
 * `export { X } from 'oxlint'` and `export default config` all arrive as
 * ALIASES, which say nothing themselves — the declaration behind them does,
 * and a declaration a value can be read from is exactly one TypeScript records
 * as a `valueDeclaration`.
 */
function carriesValue(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
    const aliased =
        symbol.declarations?.some(
            (declaration) =>
                ts.isExportSpecifier(declaration) || ts.isExportAssignment(declaration),
        ) === true;

    return (aliased ? checker.getAliasedSymbol(symbol) : symbol).valueDeclaration !== undefined;
}

/** Every name one module exports at RUNTIME, which is the surface a consumer gets. */
async function runtimeValues(entry: string): Promise<string[]> {
    const loaded: unknown = await import(entry);
    if (typeof loaded !== 'object' || loaded === null) {
        throw new Error(`${entry} did not load as a module`);
    }

    return sorted(Object.keys(loaded));
}

test.each(ENTRIES)('src/%s.js and its declaration carry the same exports', async (entry) => {
    // Given - one importable entry, read twice: as a module, and as a declaration
    const runtime = await runtimeValues(resolve(ROOT, `${entry}.js`));

    // Then - every value the runtime exports is declared, and nothing is declared that is not there
    expect(declaredValues(resolve(ROOT, `${entry}.d.ts`))).toStrictEqual(runtime);
});
