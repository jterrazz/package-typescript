/*
 * invariant: every shape here was refused by one rule of a pair whose other rule refused
 * its only alternative. The rulebook names one owner per pair, so the report stays silent
 * and `--fix` leaves the file byte for byte as it is.
 */

import type { Disposable as Kept } from './settled-pairs-source.js';

export type Shape = 'circle' | 'square';

// outside: typescript/consistent-return off for noImplicitReturns, default-case off for switch-exhaustiveness-check.
export function sides(shape: Shape): number {
    switch (shape) {
        case 'circle': {
            return 0;
        }
        case 'square': {
            return 4;
        }
    }
}

// outside: switch-exhaustiveness-check takes a `default` as the decision for the rest of a union.
export function kindOf(value: unknown): string {
    switch (typeof value) {
        case 'number': {
            return 'number';
        }
        case 'string': {
            return 'text';
        }
        default: {
            return 'other';
        }
    }
}

export type Teardown = () => void;

// outside: a teardown handed back on one path only, which consistent-return asked to spell `return undefined`.
export function watch(active: boolean, stop: Teardown): Teardown | undefined {
    if (!active) {
        return;
    }
    return stop;
}

export function onFailure(handler: (error: Error) => void): void {
    handler(new Error('refused'));
}

// outside: a callback silent on purpose is `() => undefined`: no-empty-function owns `() => {}`.
onFailure(() => undefined);

// outside: oxc/no-map-spread off for prefer-object-spread, which rewrites the Object.assign it asked for.
export const renamed = [{ id: 1, name: 'one' }].map((row) => ({ ...row, name: row.name.toUpperCase() }));

type Next = () => Promise<void>;

export function use(middleware: (context: { status: number }, next: Next) => Promise<void>): void {
    void middleware;
}

// outside: node/callback-return reads no `next`: a middleware awaits its continuation and runs on after it.
use(async (context, next) => {
    await next();
    context.status = 200;
});

// outside: promise/prefer-await-to-callbacks off: a framework's error hook is a callback by its signature.
onFailure((error) => {
    throw error;
});

// outside: no-use-before-define reads no variable from an inner scope: the module ran before the function does.
export function gridOf(): number {
    return GRID.step;
}

const GRID = { step: 4 };

const built = (): number => 1;

// outside: no-inline-comments ignores what a bundler or an editor reads where it stands.
export const lazy = /* @__PURE__ */ built();
export const query = /* sql */ `select 1`;

const z = {
    string: (): { catch: (fallback: string) => string } => ({ catch: (fallback) => fallback }),
};

// outside: a zod schema's `.catch()` takes its fallback as a value, which no promise takes.
export const language = z.string().catch('en');

// outside: an ambient global named with a leading underscore is read by bracket: dot-notation allows it where no-underscore-dangle refuses the dot form.
export const tauri: unknown = (globalThis as Record<string, unknown>)['__TAURI__'];

// outside: a disposable held only for its scope is not unused: no-unused-vars leaves a `using` declaration to the disposal it stands for.
export function scoped(open: () => Disposable): void {
    using held = open();
}

// outside: the argument TypeScript demands of a parameter typed `undefined`: no-useless-undefined reads arrow bodies only.
export function fire(argument: undefined): undefined {
    return argument;
}
fire(undefined);

// outside: a type used in the module and re-exported from it: prefer-export-from leaves an import that is also read.
export type { Kept };
export const held: Kept | undefined = undefined;

// outside: a type read through an import: consistent-type-imports allows `typeof import(...)` where the module is a type position.
export type Loaded = typeof import('./settled-pairs-source.js');

// outside: a name with a leading underscore is unused on purpose: no-unused-vars reads the underscore as the author's word, for a type parameter and a parameter.
export type Phantom<_Brand> = { readonly id: string };
export function ignoring(_unused: string): string {
    return 'ignored';
}
