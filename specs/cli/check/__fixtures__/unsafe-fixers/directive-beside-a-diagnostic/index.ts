// oxlint-disable-next-line typescript/promise-function-async -- the caller wants this very promise back
export const taken = (): Promise<number> => Promise.resolve(1);

export const other = (): Promise<number> => Promise.resolve(1);
