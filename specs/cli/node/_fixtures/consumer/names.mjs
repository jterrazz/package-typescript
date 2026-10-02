const entries = ['', '/config', '/docs', '/oxfmt', '/oxlint', '/rules'];

for (const entry of entries) {
    const loaded = await import(`@jterrazz/typescript${entry}`);
    process.stdout.write(`@jterrazz/typescript${entry}: ${Object.keys(loaded).toSorted().join(', ')}\n`);
}

const index = await import('@jterrazz/typescript');
const oxlint = await import('@jterrazz/typescript/oxlint');
const oxfmt = await import('@jterrazz/typescript/oxfmt');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const profiles = Object.keys(index.oxlint).filter((name) => name !== 'nested');
process.stdout.write(
    `the . entry's oxlint profiles are the oxlint entry's: ${profiles.every((name) => same(index.oxlint[name], oxlint[name])) ? 'yes' : 'no'}\n`,
);
process.stdout.write(`the . entry's oxfmt is the oxfmt entry's base: ${same(index.oxfmt, oxfmt.base) ? 'yes' : 'no'}\n`);
process.stdout.write(
    `the default export repeats both: ${index.default.oxlint === index.oxlint && index.default.oxfmt === index.oxfmt ? 'yes' : 'no'}\n`,
);
