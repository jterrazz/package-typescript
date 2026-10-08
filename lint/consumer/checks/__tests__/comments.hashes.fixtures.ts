export const lines = (...text: string[]): string => text.join('\n');

// invariant: each probe reads apart in one dialect — a shell quote, a recipe's quote, a make define, a YAML value's quote.
export const PROBES = {
    define: lines('define X', '# x', 'endef', '# y'),
    recipe: lines('\techo "a', '# x', '"', '# y'),
    shell: lines('echo "a', '# x', '"', '# y'),
    value: lines('key: "a', '# x', '"', '# y'),
};

const BOTH = ['x', 'y'];

const SHELL = [['y'], BOTH, ['y'], ['y']];

const YAML = [['x'], BOTH, ['x'], ['y']];

const MAKE = [BOTH, ['y'], ['y'], BOTH];

const DOCKER = [BOTH, BOTH, BOTH, BOTH];

/** A path, then how its dialect reads the shell, define, recipe and value probes. */
export const DIALECT_READS: [string, string[][]][] = [
    ['scripts/run.sh', SHELL],
    ['scripts/run.yaml.sh', SHELL],
    ['Makefile.sh', SHELL],
    ['rules.mk.sh', SHELL],
    ['deploy/Dockerfile~', SHELL],
    ['build.dockerfile.sh', SHELL],
    ['workflow.yml', YAML],
    ['workflow.yaml', YAML],
    ['Makefile', MAKE],
    ['src/GNUmakefile', MAKE],
    ['rules.mk', MAKE],
    ['Dockerfile', DOCKER],
    ['deploy/Dockerfile.prod', DOCKER],
    ['build.dockerfile', DOCKER],
];

/** A script's line, then the comments a `# x` line after it leaves read. */
export const SCRIPT_LINES: [string, string, string[]][] = [
    ['a backslash in a single quote, which escapes nothing', String.raw`echo 'a\' b`, ['x']],
    ['a quote past an odd count of characters', 'ab "c', []],
    ['a hash inside a word, which opens no comment', "echo a#'b", []],
    ['a hash a space follows inside a word', "echo a# 'b", []],
    ["a shebang's own quote", "#!/bin/sh -c 'x", ['x']],
];

/** A YAML file's line, then the comments a `# x` line after it leaves read. */
export const YAML_LINES: [string, string, string[]][] = [
    ['an escaped double quote, which closes nothing', String.raw`run: "a \" b`, []],
    ['a backslash in a single quote, which escapes nothing', String.raw`name: 'a\' b`, ['x']],
    ['two double quotes, the first closing', 'name: "a""', ['x']],
    ['a closing double quote a single one follows', `name: "a"'`, ['x']],
    ['a key spaced wide', 'name:   "a', []],
    ['a list item spaced wide', '-   name: "a', []],
    ['a list item holding the scalar', '- "a', []],
    ['a plain line holding the scalar', '"a', []],
];

/** A Makefile, then the comments outside every define. */
export const MAKEFILES: [string, string, string[]][] = [
    ['an indented define', lines('  define X', '# x', 'endef', '# y'), ['y']],
    ['modifiers spaced wide', lines('override  define X', '# x', 'endef', '# y'), ['y']],
    ['a name spaced wide', lines('define  X', '# x', 'endef', '# y'), ['y']],
    ['an indented endef', lines('define X', '# x', '  endef', '# y'), ['y']],
    ['an endef inside a line', lines('define X', 'echo endef', '# x', 'endef', '# y'), ['y']],
    ['a define inside a line', lines('VAR = define X', '# x'), ['x']],
];
