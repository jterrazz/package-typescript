export default {
    deps: { alwaysBundle: ['@vitest/spy', 'ms'], neverBundle: ['@vitest/mocker', 'vitest', 'playwright'] },
    dts: false,
    entry: ['src/index.ts', 'src/testing.ts'],
    fixedExtension: false,
};
