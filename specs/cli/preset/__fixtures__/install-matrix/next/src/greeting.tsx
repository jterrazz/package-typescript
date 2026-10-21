import type { ReactNode } from 'react';

export function Greeting({ name }: { name: string }): ReactNode {
    return <p>hello {name}</p>;
}
