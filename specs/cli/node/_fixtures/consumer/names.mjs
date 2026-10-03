const entries = ['/config', '/docs', '/oxfmt', '/oxlint', '/rules'];

for (const entry of entries) {
    const loaded = await import(`@jterrazz/typescript${entry}`);
    process.stdout.write(`@jterrazz/typescript${entry}: ${Object.keys(loaded).toSorted().join(', ')}\n`);
}

const oxlint = await import('@jterrazz/typescript/oxlint');
const oxfmt = await import('@jterrazz/typescript/oxfmt');
process.stdout.write(
    `the oxlint entry derives the declared project's rules: ${Object.keys((await oxlint.oxlintConfig(import.meta.dirname)).rules ?? {}).length > 100 ? 'yes' : 'no'}\n`,
);
process.stdout.write(`the oxfmt entry derives the estate style: ${(await oxfmt.oxfmtConfig(import.meta.dirname)).singleQuote === true ? 'yes' : 'no'}\n`);
