export default { test: { roots: process.env.CI === undefined ? ['src'] : ['lint'] } };
