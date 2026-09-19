import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

/*
 * A chain, not a document — and the product command all the same. What no
 * document can state here is the GROUND: oxlint LOADS every `oxlint.config.*`
 * it finds under the project, a fixture's included, so a committed config
 * registering a JS plugin changes what THIS repository's own lint run
 * enforces. The project is built in a temp directory instead, for the same
 * reason as `oxlint-config-unparsed.test.ts`.
 *
 * The claim is the suppression gate's: a JS plugin's rules never reach
 * `--print-config`, so a directive naming one is never dead — not even where
 * an `allow` entry put a sibling rule of that namespace in the printed map.
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
const CONFIG = `export default {
  jsPlugins: ["./demo-plugin.js"],
  overrides: [{ files: ["**/*.ts"], rules: { "demo/one": "allow" } }],
  rules: { "demo/other": "error" },
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
const MANIFEST = `{
  "name": "spec-suppressions-js-plugin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "index.ts"
}
`;

/** That project, carrying `source` as its one TypeScript file, checked. */
function checkProjectWith(source: string): { status: null | number; stdout: string } {
    project = mkdtempSync(resolve(tmpdir(), 'spec-suppressions-js-plugin-'));
    writeFileSync(join(project, 'package.json'), MANIFEST);
    writeFileSync(
        join(project, 'tsconfig.json'),
        '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["index.ts"] }\n',
    );
    writeFileSync(join(project, 'demo-plugin.js'), PLUGIN);
    writeFileSync(join(project, 'oxlint.config.ts'), CONFIG);
    writeFileSync(join(project, 'index.ts'), source);

    const result = spawnSync('bash', [BIN, 'check'], { cwd: project, encoding: 'utf8' });

    return { status: result.status, stdout: result.stdout };
}

test('leaves a directive on a JS plugin rule alone, allow entry or not', () => {
    // Given - a directive on the plugin's live rule, suppressing a diagnostic oxlint really reports
    // When - the quality checks run there
    const result = checkProjectWith(
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
    const result = checkProjectWith(
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
