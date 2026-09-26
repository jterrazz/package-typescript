/*
 * The decisions `react` owns with no framework under it: the extension a
 * bundler refuses, the call order React's runtime depends on, and what a
 * person who cannot see the page is told.
 */

// import/extensions: never — a bundler resolves the specifier, so it carries no extension.
import { useTone } from './widgets.tsx';

// react/rules-of-hooks — a hook behind a condition changes the call order between renders.
export function Badge({ muted }: { muted: boolean }): React.JSX.Element {
    if (muted) {
        const tone = useTone();
        return <output className={tone}>{tone}</output>;
    }
    return <output>loud</output>;
}

// jsx-a11y/alt-text — an image with no alternative text says nothing to a screen reader.
export function Portrait(): React.JSX.Element {
    return <img src="/portrait.png" />;
}
