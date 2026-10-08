declare const z: { string: () => { catch: (fallback: string) => unknown } };
declare function main(): Promise<void>;

export const language = z.string().catch('en');

export const started = main().then(() => true);

void (async () => {
    await main();
})();
