// invariant: every process a test spawns runs the instrumented build with this module imported first: it reports the mutants it ran — the parent credits them to the test that spawned it.
// hazard: no handler catches SIGKILL, so the reporter also hands back what is new every tenth of a second, and a process killed that way loses only its last tenth.
// invariant: a SIGTERM or a SIGINT flushes before the process dies — `child.kill()` ends a spawned process before its next tick — and the signal is raised again once the reporter's own handler is gone, so the process dies of the signal it was sent, as it would have without the reporter; another handler of the process keeps the shutdown, which its exit then reports.
export const CHILD_COVERAGE_SOURCE = `const { renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const into = process.env.__STRYKER_CHILD_COVERAGE__;
const name = \`\${process.pid}-\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;
const sent = {};
let written = 0;

function report() {
    const coverage = globalThis.__stryker__?.mutantCoverage;
    if (into === undefined || coverage === undefined) {
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
    if (!any) {
        return;
    }
    written += 1;
    const path = join(into, \`\${name}-\${written}.json\`);
    writeFileSync(\`\${path}.partial\`, JSON.stringify(fresh));
    renameSync(\`\${path}.partial\`, path);
}

process.on('exit', report);
setInterval(report, 100).unref();
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
        report();
        if (process.listenerCount(signal) === 0) {
            process.kill(process.pid, signal);
        }
    });
}
`;
