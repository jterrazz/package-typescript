import { createElement } from 'react';

export function Strip({ code }: { code: string }): React.JSX.Element {
    return (
        <section tabIndex={0}>
            <pre>{code}</pre>
        </section>
    );
}

export function Region({ as }: { as: 'div' | 'pre' }): React.JSX.Element {
    return createElement(as, { role: 'region' });
}
