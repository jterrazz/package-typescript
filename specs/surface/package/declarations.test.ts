import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

// No build step derives a `.d.ts` from its `.js`: this suite alone holds the two value surfaces together.

const ROOT = resolve(import.meta.dirname, '../../..');
const PRESETS = resolve(import.meta.dirname, '../../../src/presets/tsdown');

const ENTRIES = [
    'lint/consumer/checks/docs',
    'lint/index',
    'lint/index.docs',
    'src/config',
    'src/index',
    'src/oxfmt',
] as const;

const TSDOWN_PRESETS = ['build', 'bundle'] as const;

const sorted = (names: string[]): string[] =>
    names.toSorted((left, right) => left.localeCompare(right));

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

// `export { astro }` and `export default config` arrive as aliases; the declaration behind one is its `valueDeclaration`.
function carriesValue(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
    const aliased =
        symbol.declarations?.some(
            (declaration) =>
                ts.isExportSpecifier(declaration) || ts.isExportAssignment(declaration),
        ) === true;

    return (aliased ? checker.getAliasedSymbol(symbol) : symbol).valueDeclaration !== undefined;
}

async function runtimeValues(entry: string): Promise<string[]> {
    const loaded: unknown = await import(entry);
    if (typeof loaded !== 'object' || loaded === null) {
        throw new Error(`${entry} did not load as a module`);
    }

    return sorted(Object.keys(loaded));
}

describe('declarations', () => {
    test.each(ENTRIES)('%s.js and its declaration carry the same exports', async (entry) => {
        // Given - one importable entry, read twice: as a module, and as a declaration
        const runtime = await runtimeValues(resolve(ROOT, `${entry}.js`));

        // Then - every value the runtime exports is declared, and nothing is declared that is not there
        expect(declaredValues(resolve(ROOT, `${entry}.d.ts`))).toStrictEqual(runtime);
    });

    test.each(TSDOWN_PRESETS)(
        'src/presets/tsdown/%s.js and its declaration carry the same exports',
        async (preset) => {
            // Without a declaration a bundler config's import is `any`, or TS7016 under the `library` tsconfig.

            // Given - one shipped tsdown preset, read twice: as a module, and as a declaration
            const runtime = await runtimeValues(resolve(PRESETS, `${preset}.js`));

            // Then - the default export is declared, and nothing else is
            expect(declaredValues(resolve(PRESETS, `${preset}.d.ts`))).toStrictEqual(runtime);
        },
    );
});
