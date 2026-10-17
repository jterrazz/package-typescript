export const PROGRESS_REPORTER = 'typescript-progress';

// invariant: a run read through a pipe (an agent's log, CI) gets one line per tenth of its mutants and never Stryker's tick every ten seconds, whose running survivor count reads as a verdict; a terminal keeps Stryker's own bar. Both say how long the dry run took.
export const PROGRESS_REPORTER_SOURCE = `const STEPS = 10;

const secondsSince = (from) => (Math.round((performance.now() - from) / 100) / 10).toFixed(1);

class Progress {
    static inject = [];

    started = performance.now();
    planned = new Set();
    tested = 0;
    survived = 0;
    step = 0;
    mutating = 0;

    onDryRunCompleted() {
        process.stdout.write(\`dry run: \${secondsSince(this.started)}s — the initial run of the tests over the unmutated sandbox\\n\`);
    }

    onMutationTestingPlanReady({ mutantPlans }) {
        this.planned = new Set(mutantPlans.filter(({ plan }) => plan === 'Run').map(({ mutant }) => mutant.id));
        this.mutating = performance.now();
    }

    onMutantTested({ id, status }) {
        if (!this.planned.has(id)) {
            return;
        }
        this.tested += 1;
        if (status === 'Survived') {
            this.survived += 1;
        }
        const step = Math.floor((this.tested * STEPS) / this.planned.size);
        if (step > this.step && !process.stdout.isTTY) {
            this.step = step;
            process.stdout.write(\`progress: \${step * STEPS}% — \${this.tested} of \${this.planned.size} mutants run, \${this.survived} surviving so far, no verdict yet (\${secondsSince(this.mutating)}s)\\n\`);
        }
    }
}

export const strykerPlugins = [{ injectableClass: Progress, kind: 'Reporter', name: '${PROGRESS_REPORTER}' }];
`;
