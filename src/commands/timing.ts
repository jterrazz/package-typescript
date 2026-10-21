/** The seconds since `from`, a `performance.now()` reading, to the tenth. */
export const secondsSince = (from: number): number =>
    Math.round((performance.now() - from) / 100) / 10;
