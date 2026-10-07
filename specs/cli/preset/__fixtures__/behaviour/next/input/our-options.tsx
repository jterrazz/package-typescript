/*
 * outside: the decisions a bundler profile owns: an extension a bundler refuses, and the
 * React shape the estate writes rather than the one upstream defaults to.
 */

// outside: import/extensions: never — a bundler resolves the specifier, so it carries no extension.
export { label } from './widgets.ts';

// outside: react/function-component-definition — a named component is a declaration here.
export const Badge = ({ tone }: { tone: string }): React.JSX.Element => (
    <output className={tone}>{tone}</output>
);

// outside: one-var: never — the fixer splits the chain.
export const alpha = 1,
    beta = 2;
