import type { ReactNode } from 'react';

import { greeting } from './greeting';

export function Home({ name }: { name: string }): ReactNode {
    return <h1>{greeting(name)}</h1>;
}
