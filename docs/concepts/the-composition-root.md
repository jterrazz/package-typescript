# The composition root

An application held to [the hexagonal map](../reference/quality-checks.md#the-hexagonal-map) is built in one place: `src/composition/`. There, and only there, the implementations of `infrastructure/` meet the use cases and ports of `application/`; every other layer receives what it needs as a constructor argument and never learns which implementation it got.

## One function builds the app

`src/composition/compose.ts` exports `compose(config, overrides?)`. It calls the constructors in dependency order — the constructors are the factories, and no container library stands between them — and returns the graph: an object typed member by member, plus `[Symbol.asyncDispose]`.

Composing builds; it starts nothing. No constructor opens a port, schedules a job or dials a socket: the entry starts what the app runs — the server, the worker — once the graph is whole. `[Symbol.asyncDispose]` stops what the app runs on, in order: what drives the app (the worker, the server) before what it reads (the database), so no job or request meets a stopped dependency.

```ts
// src/composition/compose.ts
type Stoppable = { stop: () => Promise<void> };

declare function newDatabase(url: string): Stoppable;
declare function newWorker(database: Stoppable): Stoppable;

export type Ports = { database: Stoppable; worker: Stoppable };

export function compose(config: { databaseUrl: string }, overrides: Partial<Ports> = {}) {
    const database = overrides.database ?? newDatabase(config.databaseUrl);
    const worker = overrides.worker ?? newWorker(database);

    return {
        database,
        worker,
        async [Symbol.asyncDispose]() {
            await worker.stop();
            await database.stop();
        },
    };
}
```

The two `declare`d functions stand for the constructors of `infrastructure/`, which only this module imports.

When it grows past one file, it splits by layer — `platform.ts`, `outbound.ts`, `application.ts`, `inbound.ts` — each a function returning a typed slice that the next one takes.

## Two callers, and no other

The process entry and the spec runners are the only modules that import `composition/`. The entry builds the app with `await using app = compose()`, starts it, and leaving that scope runs the ordered stop. A runner builds it with what the spec stands on — `compose(testConfig, { agents, database })` — hands the specification the part it drives ([`@jterrazz/test` § API specs](https://github.com/jterrazz/package-test/blob/main/docs/guides/api-specs.md#the-constructor)), and disposes the app in its `afterAll`, before the specification's `cleanup`: no runner leaves the graph's connections open behind it.

An override is a typed member of `Partial<Ports>`: a runner names the port it replaces and hands a value of that port's type. There is no string token to misspell and no cast to lie with — a wrong double fails the type check, where a container's lookup would have failed at run time, or not at all. An override is the caller's to stop: the ordered stop closes what the app opened, never a port handed in.

## What the map holds

Two boundaries of the hexagonal map keep the root a root:

- `hexagonal-composition-wires-infrastructure` — no layer but `composition/` imports `infrastructure/` (an adapter importing its own layer aside, the specs aside: they stand outside the app and may build an adapter of their own).
- `hexagonal-composition-is-the-root` — nothing imports `composition/` but `src/index.ts` and a `specs/**/*.specification.ts` runner. A module that reached it would depend on the whole graph, and a cycle through the root would be one import away.
