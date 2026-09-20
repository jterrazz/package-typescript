import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: oxlint LOADS every `oxlint.config.*`
 * it finds under the project, a fixture's included, so a committed config
 * registering a JS plugin — or arming a rule at `error` over its own
 * deliberately broken tree — changes what THIS repository's own lint run
 * enforces. The projects are built in a temp directory instead, for the same
 * reason as `oxlint-config-unparsed.spec.ts`.
 *
 * Both claims are the suppression gate's reading of `oxlint --print-config`.
 * A JS plugin's rules never reach that report, so a directive naming one is
 * never dead. And the report is resolved PER FILE: a rule the top level leaves
 * off and an override arms is live inside the files that override names, and
 * dead outside them.
 */

const BIN = resolve(import.meta.dirname, '../../../bin/typescript.sh');

/** A JS plugin at its smallest: one namespace, two rules, no dependency. */
const PLUGIN = `export default {
  meta: { name: "demo" },
  rules: {
    one: { create: () => ({}), meta: { messages: { never: "never reported." } } },
    other: {
      create: (context) => ({
        VariableDeclarator(node) {
          if (node.id?.name === "flagged") {
            context.report({ messageId: "flagged", node });
          }
        },
      }),
      meta: { messages: { flagged: "a binding named flagged is what this rule is armed for." } },
    },
  },
};
`;

/*
 * The shape that defeated the gate. `demo/other` is armed and absent from
 * `--print-config` — no JS plugin rule reaches it — while the override writes
 * `demo/one` into the printed map, which used to make the whole `demo`
 * namespace read as one the config could answer for.
 */
const PLUGIN_CONFIG = `export default {
  jsPlugins: ["./demo-plugin.js"],
  overrides: [{ files: ["**/*.ts"], rules: { "demo/one": "allow" } }],
  rules: { "demo/other": "error" },
};
`;

/*
 * The other shape that defeated it, and the one every test-file rule of the
 * estate takes: the top level leaves the rule off and an override arms it. A
 * map flattened across the whole tree reads the `allow` and calls both
 * directives dead.
 */
const SCOPED_CONFIG = `export default {
  overrides: [{ files: ["**/*.test.ts"], rules: { "no-var": "error" } }],
  rules: { "no-var": "allow" },
};
`;

let project = '';

afterEach(() => {
    if (project) {
        rmSync(project, { force: true, recursive: true });
        project = '';
    }
});

/* Written as text, in the order the formatter sorts a manifest into: the run is
 * claimed green, so every pass of it — oxfmt's included — has to be. */
const manifestOf = (name: string) => `{
  "name": "${name}",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "index.ts"
}
`;

/** A project of the given files, checked by the product command. */
function checkProject(
    name: string,
    files: Record<string, string>,
): { status: null | number; stdout: string } {
    project = mkdtempSync(resolve(tmpdir(), `spec-${name}-`));
    writeFileSync(join(project, 'package.json'), manifestOf(`spec-${name}`));
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["**/*.ts"] }\n',
    );
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(project, path)), { recursive: true });
        writeFileSync(join(project, path), content);
    }

    const result = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    return { status: result.status, stdout: result.stdout };
}

/** That project, carrying `source` as its one TypeScript file, checked. */
function checkPluginProjectWith(source: string): { status: null | number; stdout: string } {
    return checkProject('suppressions-js-plugin', {
        'demo-plugin.js': PLUGIN,
        'index.ts': source,
        'oxlint.config.ts': PLUGIN_CONFIG,
    });
}

test('leaves a directive on a JS plugin rule alone, allow entry or not', () => {
    // Given - a directive on the plugin's live rule, suppressing a diagnostic oxlint really reports
    // When - the quality checks run there
    const result = checkPluginProjectWith(
        '// oxlint-disable-next-line demo/other -- the rule is live, and its name never reaches --print-config\n' +
            'export const flagged = "what the rule would report without this directive";\n',
    );

    // Then - the gate says nothing about it, and the whole run is green
    expect(result.stdout).not.toContain('suppressions-dead');
    expect(result.status).toBe(0);
});

test('still names a dead core rule in a project that loads a JS plugin', () => {
    // Given - the same project, plus a directive on a core rule this config leaves off
    // When - the quality checks run there
    const result = checkPluginProjectWith(
        '// oxlint-disable-next-line demo/other -- the plugin rule is live, so the gate stays silent\n' +
            'export const flagged = "what the rule would report without this directive";\n' +
            '\n' +
            '// oxlint-disable-next-line no-console -- kept from a config that had it on\n' +
            'export const nothing = "";\n',
    );

    // Then - only the core rule is called dead, and the run fails on it
    expect(result.stdout).toContain(
        'suppressions-dead  index.ts  line 4 disables no-console, which the resolved config does not have on',
    );
    expect(result.stdout).not.toContain('demo/other');
    expect(result.status).toBe(1);
});

test('leaves a directive alone where an override arms the rule it names', () => {
    // Given - a rule the top level leaves off, armed for test files, and a directive in one
    // When - the quality checks run there
    const result = checkProject('suppressions-scoped-live', {
        'index.test.ts':
            '// oxlint-disable-next-line no-var -- the override arms the rule for this file\n' +
            'export var live = "what the rule would report without this directive";\n',
        'oxlint.config.ts': SCOPED_CONFIG,
    });

    // Then - the gate says nothing about it, and the whole run is green
    expect(result.stdout).not.toContain('suppressions-dead');
    expect(result.status).toBe(0);
});

test('calls the same directive dead in a file the override does not name', () => {
    // Given - that directive again, this time in a file no override reaches
    // When - the quality checks run there
    const result = checkProject('suppressions-scoped-dead', {
        'index.ts':
            '// oxlint-disable-next-line no-var -- no override reaches this file\n' +
            'export const dead = "the same directive, where the rule is off";\n',
        'oxlint.config.ts': SCOPED_CONFIG,
    });

    // Then - it is named dead, and the run fails on it
    expect(result.stdout).toContain(
        'suppressions-dead  index.ts  line 1 disables no-var, which the resolved config does not have on',
    );
    expect(result.status).toBe(1);
});
