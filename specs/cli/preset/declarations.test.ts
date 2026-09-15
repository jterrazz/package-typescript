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

/** Every value a declaration file exports, types and interfaces left out. */
function declaredValues(declaration: string): string[] {
    const program = ts.createProgram([declaration], {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        strict: true,
    });
    const source = program.getSourceFile(declaration);
    expect(source, `${declaration} does not parse`).toBeDefined();

    const checker = program.getTypeChecker();
    const module = checker.getSymbolAtLocation(source as ts.SourceFile);
    expect(module, `${declaration} is not a module`).toBeDefined();

    return checker
        .getExportsOfModule(module as ts.Symbol)
        .filter((symbol) => (resolved(checker, symbol).flags & ts.SymbolFlags.Value) !== 0)
        .map((symbol) => symbol.name)
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * What an exported name really is. `export { astro }` and `export { X } from
 * 'oxlint'` both arrive as ALIASES, whose own flags say nothing about whether
 * they carry a value — the declaration behind them does.
 */
function resolved(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
    return (symbol.flags & ts.SymbolFlags.Alias) === 0
        ? symbol
        : checker.getAliasedSymbol(symbol);
}

test.each(ENTRIES)('src/%s.js and its declaration carry the same exports', async (entry) => {
    // Given - one importable entry, read twice: as a module, and as a declaration
    const module: Record<string, unknown> = await import(resolve(ROOT, `${entry}.js`));
    const runtime = Object.keys(module).toSorted((left, right) => left.localeCompare(right));

    // Then - every value the runtime exports is declared, and nothing is declared that is not there
    expect(declaredValues(resolve(ROOT, `${entry}.d.ts`))).toStrictEqual(runtime);
});
