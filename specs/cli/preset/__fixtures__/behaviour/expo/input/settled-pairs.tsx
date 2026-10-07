/*
 * invariant: what React Native's own libraries write, which the rulebook would refuse
 * without a reason to: the report stays silent on it.
 */

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
