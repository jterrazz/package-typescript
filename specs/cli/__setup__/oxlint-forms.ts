/** Every variable oxlint reads to pick the form of its report: an agent's compact lines, a CI's workflow commands, colour. */
export const FORM_VARIABLES = [
    'AI_AGENT',
    'CI',
    'CLAUDECODE',
    'CLAUDE_CODE',
    'CODEX_SANDBOX',
    'CODEX_THREAD_ID',
    'COPILOT_CLI',
    'CURSOR_AGENT',
    'FORCE_COLOR',
    'GEMINI_CLI',
    'GITHUB_ACTIONS',
    'JUNIE_DATA',
    'JUNIE_SHIM_PATH',
    'NO_COLOR',
    'OPENCODE',
    'REPL_ID',
];

/** The environment with only `form` deciding oxlint's report: every other form variable unset. */
export function formOnly(form: Record<string, string>): Record<string, null | string> {
    return { ...Object.fromEntries(FORM_VARIABLES.map((variable) => [variable, null])), ...form };
}

// invariant: oxlint picks its report's form from the host (an agent, a GitHub runner, a terminal), so a runner whose runs print that report states one, the compact line, for every run whose chain states none.
export const ONE_FORM = formOnly({ AI_AGENT: 'spec' });

// invariant: the toolchain prints for a GitHub job where `GITHUB_ACTIONS` is `true`, so a runner that reads a terminal's report states it unset, as a laptop leaves it, whatever the host that runs the suite.
export const TERMINAL_REPORT = { GITHUB_ACTIONS: null };

/** The host's environment, without what makes the toolchain print for a GitHub job. */
export function terminalEnvironment(): NodeJS.ProcessEnv {
    const { GITHUB_ACTIONS: _job, ...rest } = process.env;

    return rest;
}
