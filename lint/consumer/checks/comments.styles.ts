import type { Run } from './comments.js';

const STYLE_BLOCK = /<style\b(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/style>/gu;

const SASS = /\blang=["']?s[ac]ss\b/u;

// invariant: a string and a url are read whole first, so a comment marker inside one opens nothing.
const TOKENS =
    /(?<quoted>"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(?<url>url\([^)]*\)?)|(?<block>\/\*[\s\S]*?(?:\*\/|$))|(?<line>\/\/[^\n]*)/gu;

const LINE_BREAK_THEN_INDENT = /^\r?\n[ \t]*$/u;

// invariant: a doc block's stars and a `///` line's slashes open no text, so the text starts past them.
function openingOf(comment: string): string {
    let at = 2;
    while (comment.charAt(at) === comment.charAt(1)) {
        at += 1;
    }

    return comment.slice(at).trimStart();
}

// invariant: a run's offsets are the file's, the sheet's own shifted by where it starts; a Sass `//` line carries on the run of the one right above it.
function commentsOfSheet(text: string, offset: number, sass: boolean): Run[] {
    const runs: Run[] = [];
    let previous: Run | undefined;
    for (const match of text.matchAll(TOKENS)) {
        const { block, line } = match.groups ?? {};
        const start = offset + match.index;
        const end = start + match[0].length;
        if (block !== undefined) {
            runs.push({ end, opening: openingOf(block), start });
        } else if (sass && line !== undefined) {
            if (
                previous !== undefined &&
                LINE_BREAK_THEN_INDENT.test(text.slice(previous.end - offset, match.index))
            ) {
                previous.end = end;
            } else {
                previous = { end, opening: openingOf(line), start };
                runs.push(previous);
            }
        }
    }

    return runs;
}

/** A style sheet's comments, or those of each `<style>` block of a component file. */
export function commentsOfStyles(text: string, path: string): Run[] {
    if (path.endsWith('.css') || path.endsWith('.scss')) {
        return commentsOfSheet(text, 0, path.endsWith('.scss'));
    }

    return [...text.matchAll(STYLE_BLOCK)].flatMap((match) => {
        const { attributes = '', body = '' } = match.groups ?? {};
        const offset = match.index + match[0].indexOf('>') + 1;

        return commentsOfSheet(body, offset, SASS.test(attributes));
    });
}
