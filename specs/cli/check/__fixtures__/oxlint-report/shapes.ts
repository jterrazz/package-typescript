// Every shape of frame the linter draws, one per statement.
export const keys = { a: 1, b: 2, a: 3 };

export const spread = {
    a: 1,
    b: 2,
    a: 3,
};

export function declared(value: number): number {
	const unused = 'héllo — 火 日本語 👍🏽 👨‍👩‍👧 ✔️';	var legacy = value;
    legacy = legacy;
    if (value == 2) {
        debugger;
    }
    switch (value) {
        case 1:
            return 1;
        case 1:
            return 2;
    }
    return legacy;
}

export interface Point {
    x: number;
}

