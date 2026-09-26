const DECLARED =
    /^[ \t]*export[ \t]+(?:declare[ \t]+)?(?:abstract[ \t]+)?(?:async[ \t]+)?(?:function[ \t]*\*?|class)[ \t]*(?<name>[\w$]+)/gmu;

const BOUND =
    /^[ \t]*(?<exported>export[ \t]+)?(?:declare[ \t]+)?(?:const|let|var)[ \t]+(?<name>[\w$]+)[^=\n]*=/gmu;

const LOCAL_FUNCTION = /^[ \t]*(?:async[ \t]+)?(?:function[ \t]*\*?|class)[ \t]*(?<name>[\w$]+)/gmu;

const LISTED = /^[ \t]*export[ \t]*\{(?<names>[^}]*)\}(?![ \t]*from\b)/gmu;

const OPENERS = { '(': ')', '<': '>' };

function closingOf(text, start) {
    const open = text[start];
    const close = OPENERS[open];
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

function isFunctionAt(text, start) {
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

function namesOf(text) {
    const functions = [...text.matchAll(DECLARED)].map((match) => match.groups.name);
    const values = [];
    const localFunctions = new Set(
        [...text.matchAll(LOCAL_FUNCTION)].map((match) => match.groups.name),
    );
    const localValues = new Set();
    for (const match of text.matchAll(BOUND)) {
        const isFunction = isFunctionAt(text, match.index + match[0].length);
        const isExported = match.groups.exported !== undefined;
        if (isExported) {
            (isFunction ? functions : values).push(match.groups.name);
        } else {
            (isFunction ? localFunctions : localValues).add(match.groups.name);
        }
    }
    for (const match of text.matchAll(LISTED)) {
        for (const entry of match.groups.names.split(',')) {
            const [local, alias] = entry
                .trim()
                .replace(/^type\s+/u, '')
                .split(/\s+as\s+/u);
            const name = alias ?? local;
            if (local === undefined || name === 'default') {
                continue;
            }
            if (localFunctions.has(local)) {
                functions.push(name);
            } else if (localValues.has(local)) {
                values.push(name);
            }
        }
    }

    return { functions: [...new Set(functions)], values: [...new Set(values)] };
}

export function exportedFunctions(text) {
    return namesOf(text).functions;
}

export function exportedValues(text) {
    return namesOf(text).values;
}
