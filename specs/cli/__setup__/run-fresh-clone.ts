#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

// hazard: a mutation run's sandbox links its install, and git lists that link, which the `node_modules/` pattern does not ignore since it is no folder.
const INSTALL = 'node_modules';

const MODULES = join(REPOSITORY, INSTALL);

// invariant: the family's two packages are laid as `npm ci` lays them, copies whose own imports resolve from the clone: this package's own without the build a clone never holds, and @jterrazz/test whole.
const FAMILY = '@jterrazz';

const OWN = 'typescript';

const made = mkdtempSync(join(tmpdir(), 'fresh-clone-'));

const root = realpathSync(made);

// invariant: a clone holds what git tracks, and the change under test what git would add; never a build, an install or an ignored file.
const cloned = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: REPOSITORY,
    encoding: 'utf8',
})
    .stdout.split('\0')
    .filter((file) => file !== '' && file !== INSTALL && existsSync(join(REPOSITORY, file)));
for (const file of cloned) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(REPOSITORY, file), join(root, file));
}

mkdirSync(join(root, INSTALL, FAMILY), { recursive: true });
for (const name of readdirSync(MODULES).filter((one) => one !== FAMILY)) {
    symlinkSync(join(MODULES, name), join(root, INSTALL, name));
}
for (const name of readdirSync(join(MODULES, FAMILY))) {
    const installed = join(MODULES, FAMILY, name);
    cpSync(installed, join(root, INSTALL, FAMILY, name), {
        dereference: true,
        filter: (source) => name !== OWN || source !== join(installed, 'dist'),
        recursive: true,
    });
}

const built = (): number =>
    spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' }).status ?? 1;

function freshlyBuilt(): number {
    for (const unbuilt of ['dist', `${INSTALL}/${FAMILY}/${OWN}/dist`]) {
        if (existsSync(join(root, unbuilt))) {
            process.stdout.write(`not a fresh clone: ${unbuilt} exists\n`);

            return 1;
        }
        process.stdout.write(`absent before the build: ${unbuilt}\n`);
    }
    const build = built();
    if (build !== 0) {
        return build;
    }
    for (const entry of ['dist/config.js', 'dist/rules.js', 'dist/typescript.js']) {
        if (!existsSync(join(root, entry))) {
            process.stdout.write(`not built: ${entry}\n`);

            return 1;
        }
        process.stdout.write(`built: ${entry}\n`);
    }

    return 0;
}

function refused(): number {
    const build = built();
    process.stdout.write(`${existsSync(join(root, 'dist')) ? 'built' : 'built nothing'}\n`);

    return build;
}

// invariant: `gated` holds the clone in this process's name, a live gate no build of the clone runs in; `unresolved` writes a settings file that exports no settings.
const [scenario = 'fresh'] = process.argv.slice(2);
if (scenario === 'gated') {
    mkdirSync(join(root, '.artifacts'), { recursive: true });
    writeFileSync(join(root, '.artifacts/gate.lock'), String(process.pid));
} else if (scenario === 'unresolved') {
    writeFileSync(join(root, 'jterrazz.config.ts'), 'export default 42;\n');
}
process.exitCode = scenario === 'fresh' ? freshlyBuilt() : refused();
rmSync(root, { force: true, recursive: true });
