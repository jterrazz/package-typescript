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

export function Anchor(): React.JSX.Element {
    return (
        <section id="explore" tabIndex={-1}>
            <h2>Explore</h2>
        </section>
    );
}

export function Target(): React.JSX.Element {
    return (
        <section id="profile" tabIndex="-1">
            <h2>Profile</h2>
        </section>
    );
}
