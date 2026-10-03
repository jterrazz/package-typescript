const DECLARED =
    /^[ \t]*export[ \t]+(?:declare[ \t]+)?(?:abstract[ \t]+)?(?:async[ \t]+)?(?:function[ \t]*\*?|class)[ \t]*(?<name>[\w$]+)/gmu;

const BOUND =
    /^[ \t]*(?<exported>export[ \t]+)?(?:declare[ \t]+)?(?:const|let|var)[ \t]+(?<name>[\w$]+)[^=\n]*=/gmu;

const LOCAL_FUNCTION = /^[ \t]*(?:async[ \t]+)?(?:function[ \t]*\*?|class)[ \t]*(?<name>[\w$]+)/gmu;

const LISTED = /^[ \t]*export[ \t]*\{(?<names>[^}]*)\}(?![ \t]*from\b)/gmu;

const OPENERS: Readonly<Record<string, string>> = { '(': ')', '<': '>' };

function closingOf(text: string, start: number): number {
    const open = text[start];
    const close = OPENERS[open ?? ''];
    let depth = 0;
    for (let index = start; index < text.length; index += 1) {
        if (text[index] === open) {
            depth += 1;
        } else if (text[index] === close) {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

function isFunctionAt(text: string, start: number): boolean {
    let rest = text.slice(start).trimStart();
    const offset = text.length - start - rest.length;
    let at = start + offset;
    if (/^async\b/u.test(rest)) {
        rest = rest.slice('async'.length).trimStart();
        at = text.length - rest.length;
    }
    if (/^(?:function|class)\b/u.test(rest)) {
        return true;
    }
    if (/^[\w$]+\s*=>/u.test(rest)) {
        return true;
    }
    if (rest.startsWith('<')) {
        const end = closingOf(text, at);
        if (end === -1) {
            return false;
        }
        rest = text.slice(end + 1).trimStart();
        at = text.length - rest.length;
    }
    if (!rest.startsWith('(')) {
        return false;
    }
    const end = closingOf(text, at);

    return end !== -1 && /^\s*(?::[^=;{]+)?=>/u.test(text.slice(end + 1));
}

type Names = { functions: string[]; values: string[] };

function listedOf(entry: string): { local: string | undefined; name: string | undefined } {
    const [local, alias] = entry
        .trim()
        .replace(/^type\s+/u, '')
        .split(/\s+as\s+/u);

    return { local, name: alias ?? local };
}

function withListed(
    text: string,
    { functions, values }: Names,
    locals: { functions: ReadonlySet<string>; values: ReadonlySet<string> },
): void {
    for (const match of text.matchAll(LISTED)) {
        for (const { local, name } of (match.groups?.names ?? '').split(',').map(listedOf)) {
            if (local === undefined || name === undefined || name === 'default') {
                continue;
            }
            if (locals.functions.has(local)) {
                functions.push(name);
            } else if (locals.values.has(local)) {
                values.push(name);
            }
        }
    }
}

function namesOf(text: string): Names {
    const functions = [...text.matchAll(DECLARED)].map((match) => match.groups?.name ?? '');
    const values: string[] = [];
    const localFunctions = new Set(
        [...text.matchAll(LOCAL_FUNCTION)].map((match) => match.groups?.name ?? ''),
    );
    const localValues = new Set<string>();
    for (const match of text.matchAll(BOUND)) {
        const isFunction = isFunctionAt(text, match.index + match[0].length);
        const name = match.groups?.name ?? '';
        if (match.groups?.exported === undefined) {
            (isFunction ? localFunctions : localValues).add(name);
        } else {
            (isFunction ? functions : values).push(name);
        }
    }
    withListed(text, { functions, values }, { functions: localFunctions, values: localValues });

    return { functions: [...new Set(functions)], values: [...new Set(values)] };
}

export function exportedFunctions(text: string): string[] {
    return namesOf(text).functions;
}

export function exportedValues(text: string): string[] {
    return namesOf(text).values;
}
