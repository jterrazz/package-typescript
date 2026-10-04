import type { ReactNode } from 'react';

import { greeting } from '@/greeting';

export default function Home(): ReactNode {
    return greeting('Ada');
}
