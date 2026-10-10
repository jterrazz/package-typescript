/*
 * invariant: what React Native's own libraries write, which the rulebook would refuse
 * without a reason to: the report stays silent on it.
 */

// outside: import/extensions spares a package subpath: `expo` maps no exports, so its subpath resolves only by its file name.
import { getDefaultConfig } from 'expo/metro-config.js';

export const metro: unknown = getDefaultConfig;

const Gesture = {
    Pan: (): { enabled: boolean } => ({ enabled: true }),
};

// outside: react/capitalized-calls off: react-native-gesture-handler builds a gesture with a capitalised factory.
export function Panned(): React.JSX.Element {
    const pan = Gesture.Pan();
    return <output>{String(pan.enabled)}</output>;
}

// outside: a StyleSheet declared below the component that reads it at render.
export function Card(): React.JSX.Element {
    return <output style={styles.card}>card</output>;
}

const styles = { card: { padding: 4 } };

const z = {
    string: (): { catch: (fallback: string) => string } => ({ catch: (fallback) => fallback }),
};

// outside: a zod schema's `.catch()` takes its fallback as a value, which no promise takes.
export const language = z.string().catch('en');

// outside: a name with a leading underscore is unused on purpose: no-unused-vars reads the underscore as the author's word, for a type parameter and a parameter.
export type Phantom<_Brand> = { readonly id: string };
export function ignoring(_unused: string): string {
    return 'ignored';
}
