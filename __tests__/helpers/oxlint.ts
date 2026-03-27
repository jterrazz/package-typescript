import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "../..");
const OXLINT_BIN = resolve(ROOT_DIR, "node_modules/.bin/oxlint");

export type LintResult = {
  success: boolean;
  output: string;
};

export function runOxlint(configPath: string, cwd: string): LintResult {
  try {
    const output = execSync(`${OXLINT_BIN} -c ${configPath} .`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (error: any) {
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";
    const output = stdout + stderr;
    return { success: false, output };
  }
}

export function hasErrorOnFile(output: string, file: string, rule: string): boolean {
  // Strip ANSI escape codes for reliable matching
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  const cleanOutput = output.replace(ansiRegex, "");

  const escapedFile = file.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

  // Match visual format: ╭─[file:line:col] or ,─[file:line:col]
  const visualPattern = new RegExp(`(?:╭─\\[|,─\\[|\\[)${escapedFile}:\\d+:\\d+\\]`, "g");
  let match;
  while ((match = visualPattern.exec(cleanOutput)) !== null) {
    const start = Math.max(0, match.index - 300);
    const preceding = cleanOutput.substring(start, match.index);
    if (preceding.includes(rule)) {
      return true;
    }
  }

  // Match GitHub Actions annotation format: ::error file=filename,...,title=eslint(rule)::
  // Rules may appear as eslint(rule) or eslint-plugin-name(rule) or codestyle(rule)
  const escapedRule = rule.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const ghPattern = new RegExp(
    `::(?:error|warning|notice) file=${escapedFile},.*title=.*\\(${escapedRule}\\)`,
    "g",
  );
  if (ghPattern.test(cleanOutput)) {
    return true;
  }

  return false;
}

export function expectError(output: string, file: string, rule: string): void {
  const has = hasErrorOnFile(output, file, rule);
  if (!has) {
    throw new Error(`Expected rule "${rule}" to trigger on "${file}"`);
  }
}

export function expectNoError(output: string, file: string, rule: string): void {
  const has = hasErrorOnFile(output, file, rule);
  if (has) {
    throw new Error(`Expected rule "${rule}" NOT to trigger on "${file}"`);
  }
}
