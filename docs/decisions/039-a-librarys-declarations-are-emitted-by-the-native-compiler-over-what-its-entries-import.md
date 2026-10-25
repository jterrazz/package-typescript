# ADR-039: A library's declarations are emitted by the native compiler, over what its entries import

**Status:** Accepted
**Date:** 2026-10-25

**Accepted:** 2026-10-25: the owner's word ("ok pour tout, go tout update et terminer").

The owner asked for it on 2026-10-25: `typescript build` stops emitting the
declarations with the JavaScript compiler, TypeScript 6, and emits them with
oxc or with the native compiler, whichever every library consumer can take.

## Context

Since [ADR-018](018-a-project-declares-what-it-is-and-every-config-follows.md#consequences)
a library's declarations come from the type-checker, so an inferred export
is published with the type the checker infers, and one a consumer could not
name fails the build (TS2883). tsdown handed that to rolldown-plugin-dts
with `dts: true`, which picks its `tsc` generator while the tree's
`typescript` is 6: the JavaScript compiler, in the build's own process. It
was most of a build: 4.3 to 4.8 s and 1.2 to 1.3 GB on `@jterrazz/test`
(the numbers below).

Three generators were open, each tried on every repository whose build
emits declarations: this package, `@jterrazz/test`, `@jterrazz/intelligence`,
`@jterrazz/manifest`, `@jterrazz/telemetry`, `@jterrazz/analytics`,
`@jterrazz/broadcast`, `@jterrazz/attestation`, the `design` member of
jterrazz-design and the `analysis` member of hoverfly-lsp. The other
repositories that run `typescript build` (vscode-folder-regex-color,
signews-api, signews-broadcast) are private, and emit none.

- **oxc**, file by file, needs every source an entry reaches to be
  `isolatedDeclarations`-clean. Counted with oxc's own transform over every
  source each build reaches: 193 errors in 111 files on `@jterrazz/test`, 92
  in 74 here, 15 on broadcast, 11 on attestation, 6 on intelligence, 2 on
  hoverfly-lsp, none on the four others. The flag also fights
  `no-inferrable-types`, which is why ADR-018 left it.
- **tsgo through the 7.1 API**, in rolldown-plugin-dts 0.29.0-beta.2 (which
  tsdown 0.23.2 requires), emits one file at a time with no configuration of
  ours. It cannot be reached: it loads `typescript/async` beside the module
  it is pointed at, which resolves the tree's `typescript`, 6, never the
  `@typescript/native` alias, and
  [ADR-032](032-the-mutant-checker-runs-on-the-native-compiler.md) keeps
  `typescript@7` out of the tree under its own name.
- **tsgo through the compiler's command line**, in rolldown-plugin-dts
  0.28.8 (tsdown 0.23.1, the installed pair), runs the compiler once per
  build step with `-p` on the project's `tsconfig.json`. That program holds
  the tests the tsconfig includes: on `@jterrazz/test` it refused 56 of
  their declarations (TS4094), which no build publishes.

The compiler matters as much as the generator. On the case of
`specs/cli/build/unnameable-declarations.spec.ts`, TypeScript 7.0.2 emits
`import("dep-b").Thing`, a declaration no consumer resolves, and exits 0;
7.1.0-beta refuses it with the two TS2883 TypeScript 6 prints, word for word.

## Decision

- A step that emits declarations hands them to the `tsgo` generator of
  rolldown-plugin-dts 0.28.8, run on the compiler `typescript check` type-checks
  with (`tscBinary()`), which is 7.1.0-beta from
  [ADR-038](038-every-type-check-runs-on-the-one-native-compiler.md).
- The compiler reads the project's own options over the step's entries
  alone: a `tsconfig.<step>.json` that extends the project's
  `tsconfig.json`, lists the entries as its `files`, includes nothing else
  and writes no build info. The generator is handed a script that runs the
  compiler with its arguments and that `-p` last, since the compiler reads
  the last `-p` it is handed (measured on 6.0.3, 7.0.2 and 7.1.0-beta).
- Both sit in a scratch folder under the project's `.artifacts/`, removed
  when the build ends, because the compiler resolves what a tsconfig names
  (`types: ["node"]`) from the folder the tsconfig sits in.
- The generator's log is dropped: its one line, on every build, says the
  native compiler's API is experimental, and the build never calls that API.
- No version moves: tsdown 0.23.1, rolldown-plugin-dts 0.28.8 and
  `@typescript/native` 7.1.0-beta (2026-10-20, under the waiver of the
  two-week rule) are the installed ones.

## Consequences

- A build is 2.6 to 4.6 times faster, its largest process 0.3 to 0.4 times as heavy. Three
  warm runs of `typescript build` each, the base and this build interleaved,
  wall time and the largest process's resident memory:

    | Project                | TypeScript 6                | native compiler         |
    | ---------------------- | --------------------------- | ----------------------- |
    | `@jterrazz/typescript` | 1.60-1.90 s, 561-601 MB     | 0.61-0.63 s, 208-217 MB |
    | `@jterrazz/test`       | 4.33-4.80 s, 1,162-1,277 MB | 0.99-1.04 s, 350-353 MB |
    | intelligence           | 1.36-1.49 s, 493-519 MB     | 0.38-0.54 s, 152-159 MB |
    | attestation            | 1.54-1.76 s, 502-511 MB     | 0.48-0.60 s, 175-193 MB |
    | broadcast              | 1.10-1.88 s, 328-332 MB     | 0.32-0.41 s, 104-105 MB |
    | hoverfly-lsp           | 0.89-1.37 s, 326-361 MB     | 0.34-0.37 s, 122-125 MB |
    | telemetry              | 0.87-0.94 s, 359-374 MB     | 0.32-0.33 s, 119-121 MB |
    | analytics              | 0.76-1.05 s, 295-331 MB     | 0.31-0.34 s, 102-103 MB |
    | manifest               | 0.87-0.96 s, 336-387 MB     | 0.28-0.36 s, 102-104 MB |
    | jterrazz-design        | 0.87-1.08 s, 266-290 MB     | 0.33-0.39 s, 109-112 MB |

- The declarations are the same types. Against TypeScript 6's, every
  repository above builds the same JavaScript byte for byte; its
  declarations differ on six files here, two on `@jterrazz/test`, two on
  attestation, two on jterrazz-design and one on hoverfly-lsp, and each
  compares equal once its string literals are printed in one quote style and
  its unions' members sorted. The native compiler keeps a literal type in the
  quotes of its source, and orders one union of `@jterrazz/test`
  (`StubResponder | StubResponse`) the other way.
- An entry on no disk is now named by the compiler (TS6053) before the
  bundler names it, and the compiler's refusals (TS2883, TS6053) print on
  the build's output, above tsdown's report, where the plugin printed them
  on its error stream.
- A project that emits declarations keeps a `tsconfig.json` at its root,
  which `typescript fix` derives; without one the build fails on tsdown's
  report, where TypeScript 6 emitted on its default options.
- The compiler is run by a `sh` script, as every host of the estate has.
- The command-line generator is the stable half of a plugin moving to the
  7.1 API: tsdown 0.23.2 takes rolldown-plugin-dts 0.29, where the generator
  options move and `tsgo` drives the API. That move waits for the plugin to
  find the API through an alias, or for `typescript` to be 7 in the tree,
  which ADR-032 forbids today.
