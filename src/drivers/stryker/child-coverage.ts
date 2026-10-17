// invariant: every process a test spawns runs the instrumented build with this module imported first: it reports the mutants it ran (the parent credits them to the test that spawned it) and leaves `<name>.started` the moment it starts, so the parent knows the test spawned a process even when it ran no mutant.
// invariant: it also hands back, as `<name>-<n>.functions`, every script of the process whose body ran and the start of every function it ran since its last report, read from V8's precise coverage, so the parent can name the sources a test's processes ran and loaded; a script's body is its loading, not a function it ran, and Stryker's helpers, which every instrumented module calls as it loads, are none of the module's own functions; a process V8 will not profile leaves `<name>.blind`, and the parent reads its test as one that may have run any source.
// hazard: no handler catches SIGKILL, so the reporter also hands back what is new every 25 milliseconds, and a process killed that way loses only its last 25.
// invariant: a test's end asks every live reporter to flush: the parent writes a sequence number to `flush` in the folder, each reporter hands back what is new and answers with `<name>.ack`, and the parent reads the test's coverage once every live one has, so what a child ran during a test is credited to it, not to the next one. A reporter is live while its `<name>.alive` stands, and the pid at the head of its name tells a killed one from one that is still running.
// hazard: a signal a process sends itself would be delivered after the script ended, and the process would exit 0 instead of dying of it: `process.kill` on the process's own pid flushes and takes the handler off first, so the operating system's default acts at once.
// invariant: a SIGTERM or a SIGINT flushes before the process dies (`child.kill()` ends a spawned process before its next tick), and the signal is raised again once the reporter's own handler is gone, so the process dies of the signal it was sent, as it would have without the reporter; another handler of the process keeps the shutdown, which its exit then reports.
export const CHILD_COVERAGE_SOURCE = `const { readFileSync, renameSync, unlinkSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const into = process.env.__STRYKER_CHILD_COVERAGE__;
const name = \`\${process.pid}-\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;
const sent = {};
let written = 0;
let acknowledged;

function handed(suffix, value) {
    written += 1;
    const path = join(into, \`\${name}-\${written}.\${suffix}\`);
    writeFileSync(\`\${path}.partial\`, JSON.stringify(value));
    renameSync(\`\${path}.partial\`, path);
}

const functionsRan = (() => {
    if (into === undefined) {
        return () => [];
    }
    try {
        const { Session } = require('node:inspector');
        const session = new Session();
        session.connect();
        session.post('Profiler.enable');
        session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
        return () => {
            let taken = [];
            session.post('Profiler.takePreciseCoverage', (error, coverage) => {
                taken = error ? undefined : coverage.result;
            });
            if (taken === undefined) {
                writeFileSync(join(into, \`\${name}.blind\`), '');
                return [];
            }
            return taken;
        };
    } catch {
        writeFileSync(join(into, \`\${name}.blind\`), '');
        return () => [];
    }
})();

const ownUrl = require('node:url').pathToFileURL(__filename).href;

const STRYKER_HELPER = /^stry(?:NS|Cov|MutAct)_[0-9a-f]{5}/u;

function reportFunctions() {
    const fresh = {};
    let any = false;
    for (const script of functionsRan()) {
        const [body, ...functions] = script.functions;
        if (!script.url.startsWith('file:') || script.url === ownUrl || body === undefined) {
            continue;
        }
        const helpers = functions.filter((one) => STRYKER_HELPER.test(one.functionName)).map((one) => one.ranges[0]);
        const inHelper = ({ endOffset, startOffset }) => helpers.some((helper) => helper.startOffset <= startOffset && endOffset <= helper.endOffset);
        fresh[script.url] = functions
            .map((one) => one.ranges[0])
            .filter((range) => range.count > 0 && !inHelper(range))
            .map((range) => range.startOffset);
        any = true;
    }
    if (any) {
        handed('functions', fresh);
    }
}

function report() {
    if (into === undefined) {
        return;
    }
    reportFunctions();
    const coverage = globalThis.__stryker__?.mutantCoverage;
    if (coverage === undefined) {
        return;
    }
    const hits = { ...coverage.static };
    for (const perTest of Object.values(coverage.perTest)) {
        for (const [id, count] of Object.entries(perTest)) {
            hits[id] = (hits[id] ?? 0) + count;
        }
    }
    const fresh = {};
    let any = false;
    for (const [id, count] of Object.entries(hits)) {
        if (count > (sent[id] ?? 0)) {
            fresh[id] = count - (sent[id] ?? 0);
            sent[id] = count;
            any = true;
        }
    }
    if (any) {
        handed('json', fresh);
    }
}

function acknowledge() {
    let asked;
    try {
        asked = readFileSync(join(into, 'flush'), 'utf8');
    } catch {
        return;
    }
    if (asked !== acknowledged) {
        report();
        writeFileSync(join(into, \`\${name}.ack\`), asked);
        acknowledged = asked;
    }
}

if (into !== undefined) {
    writeFileSync(join(into, \`\${name}.alive\`), '');
    writeFileSync(join(into, \`\${name}.started\`), '');
}
process.on('exit', () => {
    report();
    try {
        unlinkSync(join(into, \`\${name}.alive\`));
    } catch {}
});
setInterval(() => {
    report();
    if (into !== undefined) {
        acknowledge();
    }
}, 25).unref();
const handlers = {};
for (const signal of ['SIGINT', 'SIGTERM']) {
    handlers[signal] = () => {
        report();
        if (process.listenerCount(signal) === 0) {
            process.kill(process.pid, signal);
        }
    };
    process.once(signal, handlers[signal]);
}

const kill = process.kill;
process.kill = function (pid, signal) {
    const handler = pid === process.pid ? handlers[signal ?? 'SIGTERM'] : undefined;
    if (handler !== undefined) {
        report();
        process.removeListener(signal ?? 'SIGTERM', handler);
    }
    return kill.call(this, pid, signal);
};
`;
