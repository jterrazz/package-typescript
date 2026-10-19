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
