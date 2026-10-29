import { relative, resolve } from 'node:path';

// outside: GitHub reads a line of the log as a workflow command, `::<name> <key>=<value>,...::<message>`; a message escapes `%`, CR and LF, a property `:` and `,` as well.

/** Whether the run is a GitHub Actions job, which sets `GITHUB_ACTIONS=true` on every step. */
export const onGitHub = (environment: NodeJS.ProcessEnv): boolean =>
    environment.GITHUB_ACTIONS === 'true';

/** A workflow command's message, escaped so GitHub reads it back whole. */
export const escapedData = (text: string): string =>
    text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

/** A workflow command's property value, escaped so a `:` or a `,` never ends it. */
export const escapedProperty = (text: string): string =>
    escapedData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');

export type Annotation = {
    column?: number | undefined;
    line?: number | undefined;
    message: string;
    path?: string | undefined;
    severity: 'error' | 'warning';
    title: string;
};

/** Where an annotation points: a path from the workspace GitHub checked out, which is the one an annotation is shown on; the project's own path where no workspace is named. */
export function workspacePathOf(
    path: string,
    project: string,
    workspace: string | undefined,
): string {
    if (workspace === undefined) {
        return path;
    }
    const from = relative(workspace, resolve(project, path));

    return from.startsWith('..') ? path : from;
}

/** One annotation as GitHub reads it: `::error file=…,line=…,col=…,title=…::<message>`, the place omitted where the finding has none. */
export function annotationOf({ column, line, message, path, severity, title }: Annotation): string {
    const located =
        path === undefined
            ? []
            : [
                  `file=${escapedProperty(path)}`,
                  `line=${String(line ?? 1)}`,
                  `col=${String(column ?? 1)}`,
              ];
    const properties = [...located, `title=${escapedProperty(title)}`].join(',');

    return `::${severity} ${properties}::${escapedData(message)}`;
}

/** A fold of the log, its title shown while it stays closed; GitHub reads no command inside it until `token` resumes them, so a tool's own annotations never double the run's. */
export const groupOf = (title: string, body: string, token: string): string =>
    `::group::${escapedData(title)}\n::stop-commands::${token}\n${body}${body.endsWith('\n') ? '' : '\n'}::${token}::\n::endgroup::\n`;
