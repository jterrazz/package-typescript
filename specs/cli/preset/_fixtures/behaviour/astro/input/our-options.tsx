/*
 * The decisions a bundler profile owns: an extension a bundler refuses, the one
 * extension Astro's own resolver needs, the stylesheet import a layout makes,
 * and the React shape the estate writes rather than the one upstream defaults
 * to.
 */

// import/no-unassigned-import: allow *.css — a stylesheet import IS its own
// assignment, so this line reports nothing.
import './global.css';

// import/extensions: never — a bundler resolves the specifier, so it carries no extension.
export { label } from './widgets.ts';

// import/extensions: astro always — Astro's resolve.extensions does not carry
// `.astro`, so a layout keeps the extension the rest of the tree drops, and
// this line reports NOTHING. Under a bare `never` it was a diagnostic.
export { default as Layout } from './layout.astro';

// react/function-component-definition — a named component is a declaration here.
export const Badge = ({ tone }: { tone: string }): React.JSX.Element => (
    <output className={tone}>{tone}</output>
);

// one-var: never — the fixer splits the chain.
export const alpha = 1,
    beta = 2;
