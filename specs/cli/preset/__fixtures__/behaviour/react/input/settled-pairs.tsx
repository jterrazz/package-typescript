/*
 * invariant: every shape here was refused by one rule of a pair whose other rule refused
 * its only alternative. The rulebook names one owner per pair, so the report stays silent.
 */

import { useEffect, useRef, useState } from 'react';

// outside: an effect returning its cleanup on one path: consistent-return wanted the `return undefined` unicorn refuses.
export function Clock({ live }: { live: boolean }): React.JSX.Element {
    const [now, setNow] = useState(0);
    useEffect(() => {
        if (!live) {
            return;
        }
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    }, [live]);
    return <output>{now}</output>;
}

// outside: an effect returning its cleanup inside an `if`: noImplicitReturns asks the bare `return;` no-useless-return refused.
export function Ticker({ live }: { live: boolean }): React.JSX.Element {
    const [ticks, setTicks] = useState(0);
    useEffect(() => {
        if (live) {
            const timer = setInterval(() => {
                setTicks((count) => count + 1);
            }, 1000);
            return () => {
                clearInterval(timer);
            };
        }
        return;
    }, [live]);
    return <output>{ticks}</output>;
}

class Painter {
    readonly strokes: number[] = [];
}

// outside: react/todo off: a lazy init is the `??=` prefer-nullish-coalescing asks for, which the compiler does not compile yet.
export function Canvas(): React.JSX.Element {
    const painter = useRef<null | Painter>(null);
    useEffect(() => {
        painter.current ??= new Painter();
        painter.current.strokes.push(1);
    }, []);
    return <canvas />;
}

type Rail = { onDayChange: (day: number) => void };

function Days({ onDayChange }: Rail): React.JSX.Element {
    return (
        <button
            onClick={() => {
                onDayChange(1);
            }}
            type="button"
        >
            day
        </button>
    );
}

// outside: react/jsx-handler-names takes an `on*` member forwarded to the prop of its name.
export function Calendar({ rail }: { rail: Rail }): React.JSX.Element {
    return <Days onDayChange={rail.onDayChange} />;
}

// outside: a scrollable region reached by the keyboard: no-noninteractive-tabindex refused its tabIndex, prefer-tag-over-role its role.
export function Listing({ code }: { code: string }): React.JSX.Element {
    return (
        <section aria-label="Source" tabIndex={0}>
            <pre>{code}</pre>
        </section>
    );
}
