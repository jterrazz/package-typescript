import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';

import { refusal } from '../../kit/catalogue/lesson.js';
import { shippedModules } from '../../kit/testing/shipped-modules.js';

const ID = 'src-layout';

const READ = 'docs/concepts/architecture.md#commands-and-drivers';

const COMMANDS = 'src/commands';

const DRIVERS = 'src/drivers';

const PRESETS = 'src/presets';

const DISPATCHER = `${COMMANDS}/main.ts`;

const WHY_COMMAND =
    'a subcommand a user types is one folder of src/commands/ and one `<name>.command.ts` in it, so the tree lists the commands the usage prints and what only one of them uses sits beside it';

const WHY_DRIVER =
    'an external tool is driven from one folder of src/drivers/ alone — its binary resolved, its process spawned, its package imported there, its config beside it in src/presets/ — so a change of the tool lands in one place';

// invariant: every package of a tool a driver drives, by the folder of its driver.
const TOOL_PACKAGES: Readonly<Record<string, readonly string[]>> = {
    attw: ['@arethetypeswrong/cli'],
    'dependency-cruiser': ['dependency-cruiser'],
    knip: ['knip'],
    'ls-lint': ['@ls-lint/ls-lint'],
    oxfmt: ['oxfmt'],
    oxlint: ['oxlint', 'oxlint-tsgolint'],
    prettier: ['prettier', 'prettier-plugin-astro'],
    publint: ['publint'],
    rumdl: ['rumdl'],
    stryker: ['@stryker-mutator/core', '@stryker-mutator/vitest-runner'],
    tsdown: ['tsdown'],
};

export type SrcLayoutFinding = { message: string; path: string };

type Edge = { names: readonly string[]; specifier: string; target: string; value: boolean };

type Lock = {
    breaks: (module: string, edge: Edge) => boolean;
    fix: (edge: Edge) => string;
    found: (module: string, edge: Edge) => string;
};

const isUnder = (folder: string, path: string): boolean => path.startsWith(`${folder}/`);

function driverFolderOf(path: string): string | undefined {
    const [folder, ...rest] = isUnder(DRIVERS, path)
        ? path.slice(DRIVERS.length + 1).split('/')
        : [];

    return rest.length > 0 ? folder : undefined;
}

const packageOf = (specifier: string): string =>
    specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/');

const toolOf = (edge: Edge): string =>
    Object.entries(TOOL_PACKAGES).find(([, packages]) =>
        packages.includes(packageOf(edge.specifier)),
    )?.[0] ?? '';

const LOCKS: readonly Lock[] = [
    {
        breaks: (module, { target }) =>
            !isUnder(DRIVERS, module) &&
            ['child_process', 'node:child_process', `${DRIVERS}/run.ts`].includes(target),
        fix: () =>
            `move the run into the driver of its tool, under ${DRIVERS}/<tool>/, and call the driver`,
        found: (module, { specifier }) => `\`${module}\` spawns a process through \`${specifier}\``,
    },
    {
        breaks: (module, { names, target }) =>
            !isUnder(DRIVERS, module) &&
            target === 'lint/kit/project/package-root.ts' &&
            names.some((name) => name === 'binaryIn' || name === 'projectBinary'),
        fix: () => `resolve it in the driver of that tool, under ${DRIVERS}/<tool>/`,
        found: (module) => `\`${module}\` resolves a tool's binary`,
    },
    {
        breaks: (module, edge) =>
            edge.value &&
            toolOf(edge) !== '' &&
            driverFolderOf(module) !== toolOf(edge) &&
            !isUnder(`${PRESETS}/${toolOf(edge)}`, module),
        fix: (edge) =>
            `import it in ${DRIVERS}/${toolOf(edge)}/, or in the config ${PRESETS}/${toolOf(edge)}/ holds for it, or import its types only`,
        found: (module, edge) =>
            `\`${module}\` imports \`${edge.specifier}\`, the package of the tool ${DRIVERS}/${toolOf(edge)}/ drives`,
    },
    {
        breaks: (module, { target }) =>
            driverFolderOf(module) !== undefined &&
            driverFolderOf(target) !== undefined &&
            driverFolderOf(target) !== driverFolderOf(module),
        fix: () =>
            `keep one tool in one folder: what two drivers share sits at the root of ${DRIVERS}/`,
        found: (module, { target }) => `\`${module}\` imports \`${target}\`, another tool's driver`,
    },
    {
        breaks: (module, { target }) => isUnder(DRIVERS, module) && isUnder(COMMANDS, target),
        fix: () =>
            'hand the driver what it needs as arguments: a command calls a driver, never the reverse',
        found: (module, { target }) => `\`${module}\` imports \`${target}\`, a command`,
    },
];

function finding(path: string, found: string, why: string, fix: string): SrcLayoutFinding {
    return { message: `${ID}  ${refusal({ fix, found, read: READ, why })}`, path };
}

function foldersIn(root: string, folder: string): string[] {
    const path = join(root, folder);

    return existsSync(path)
        ? readdirSync(path, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .toSorted()
        : [];
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
    visit(node);
    ts.forEachChild(node, (child) => {
        walk(child, visit);
    });
}

type Imported = Pick<Edge, 'names' | 'value'>;

function importOf(node: ts.ImportDeclaration): Imported {
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    const named = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [];
    const values = named.filter((element) => !element.isTypeOnly);
    const typeOnly =
        clause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
        (clause?.name === undefined && named.length > 0 && values.length === 0);

    return {
        names: values.map((element) => (element.propertyName ?? element.name).text),
        value: !typeOnly,
    };
}

function importedBy(node: ts.Node): [ts.Expression | undefined, Imported] | undefined {
    if (ts.isImportDeclaration(node)) {
        return [node.moduleSpecifier, importOf(node)];
    }
    if (ts.isExportDeclaration(node)) {
        return [node.moduleSpecifier, { names: [], value: !node.isTypeOnly }];
    }

    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? [node.arguments[0], { names: [], value: true }]
        : undefined;
}

function edgesOf(module: string, source: ts.SourceFile): Edge[] {
    const edges: Edge[] = [];
    walk(source, (node) => {
        const [specifier, imported] = importedBy(node) ?? [];
        if (specifier !== undefined && imported !== undefined && ts.isStringLiteral(specifier)) {
            const { text } = specifier;
            const target = text.startsWith('.')
                ? posix.join(posix.dirname(module), text).replace(/\.js$/u, '.ts')
                : text;
            edges.push({ ...imported, specifier: text, target });
        }
    });

    return edges;
}

function dispatched(root: string): string[] {
    const path = join(root, DISPATCHER);
    if (!existsSync(path)) {
        return [];
    }
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
    const literals: ts.ObjectLiteralExpression[] = [];
    walk(source, (node) => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'COMMANDS') {
            walk(node, (inner) => {
                if (ts.isObjectLiteralExpression(inner)) {
                    literals.push(inner);
                }
            });
        }
    });
    // invariant: the table is the widest literal its initializer holds, whatever wraps it.
    const [table] = literals.toSorted(
        (left, right) => right.properties.length - left.properties.length,
    );

    return (table?.properties ?? []).flatMap(({ name }) =>
        name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name))
            ? [name.text]
            : [],
    );
}

const commandFile = (folder: string): string => `${COMMANDS}/${folder}/${folder}.command.ts`;

function commandFindings(root: string, modules: readonly string[]): SrcLayoutFinding[] {
    const folders = foldersIn(root, COMMANDS);
    const typed = new Set(dispatched(root));
    const misplaced = modules.filter(
        (module) =>
            module.endsWith('.command.ts') &&
            !posix.basename(module).startsWith('index.') &&
            !folders.some((folder) => module === commandFile(folder)),
    );

    return [
        ...folders
            .filter((folder) => !existsSync(join(root, commandFile(folder))))
            .map((folder) =>
                finding(
                    `${COMMANDS}/${folder}/`,
                    `\`${COMMANDS}/${folder}/\` holds no \`${folder}.command.ts\``,
                    WHY_COMMAND,
                    `name the module the subcommand starts from \`${folder}.command.ts\``,
                ),
            ),
        ...misplaced.map((module) =>
            finding(
                module,
                `\`${module}\` is a command module outside its folder`,
                WHY_COMMAND,
                `move it to ${COMMANDS}/<name>/<name>.command.ts`,
            ),
        ),
        ...[...typed]
            .filter((name) => !folders.includes(name))
            .map((name) =>
                finding(
                    DISPATCHER,
                    `the subcommand \`${name}\` has no folder under ${COMMANDS}/`,
                    WHY_COMMAND,
                    `move it to ${commandFile(name)}`,
                ),
            ),
        ...folders
            .filter((folder) => typed.size > 0 && !typed.has(folder))
            .map((folder) =>
                finding(
                    `${COMMANDS}/${folder}/`,
                    `\`${COMMANDS}/${folder}/\` is a subcommand ${DISPATCHER} does not dispatch`,
                    WHY_COMMAND,
                    'dispatch it, or fold what it holds into the command that uses it',
                ),
            ),
    ];
}

function driverFindings(root: string, modules: readonly string[]): SrcLayoutFinding[] {
    return [
        ...foldersIn(root, DRIVERS)
            .filter((folder) => !existsSync(join(root, DRIVERS, folder, `${folder}.ts`)))
            .map((folder) =>
                finding(
                    `${DRIVERS}/${folder}/`,
                    `\`${DRIVERS}/${folder}/\` holds no \`${folder}.ts\``,
                    WHY_DRIVER,
                    `name the module that drives ${folder} \`${folder}.ts\``,
                ),
            ),
        ...modules.flatMap((module) => {
            const text = readFileSync(join(root, module), 'utf8');
            const source = ts.createSourceFile(module, text, ts.ScriptTarget.Latest);

            return edgesOf(module, source).flatMap((edge) =>
                LOCKS.filter((lock) => lock.breaks(module, edge)).map((lock) =>
                    finding(module, lock.found(module, edge), WHY_DRIVER, lock.fix(edge)),
                ),
            );
        }),
    ];
}

/** The commands a user types, one folder each, and the tools they run, each driven from its own folder alone. */
export function srcLayoutFindings(root: string): SrcLayoutFinding[] {
    const modules = existsSync(join(root, 'src'))
        ? shippedModules(root, join(root, 'src')).filter((module) => module.endsWith('.ts'))
        : [];

    return [...commandFindings(root, modules), ...driverFindings(root, modules)];
}
