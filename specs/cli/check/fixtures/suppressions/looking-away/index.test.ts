// oxlint-disable-next-line vitest/max-expects -- armed for test files only, so the directive is live here
export const spec = "";

export const quoted = "// oxlint-disable-next-line no-console";

export const templated = `
// oxlint-disable-next-line no-alert
/* @ts-ignore */ ${quoted}
`;
