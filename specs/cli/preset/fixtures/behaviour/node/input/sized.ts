/*
 * The size and complexity decisions, each at the edge it draws, one case on each
 * side of it. `complexity` is 12 in its `modified` variant, where a `switch`
 * counts once; a function holds 60 lines, where upstream's default is 50; a file
 * holds 300 — and this one is longer, so it is reported once, at its last line.
 */

// complexity: modified — fifteen paths under the classic count, one decision here.
export function route(kind: string): number {
    switch (kind) {
        case 'kind-0': {
            return 0;
        }
        case 'kind-1': {
            return 1;
        }
        case 'kind-2': {
            return 2;
        }
        case 'kind-3': {
            return 3;
        }
        case 'kind-4': {
            return 4;
        }
        case 'kind-5': {
            return 5;
        }
        case 'kind-6': {
            return 6;
        }
        case 'kind-7': {
            return 7;
        }
        case 'kind-8': {
            return 8;
        }
        case 'kind-9': {
            return 9;
        }
        case 'kind-10': {
            return 10;
        }
        case 'kind-11': {
            return 11;
        }
        case 'kind-12': {
            return 12;
        }
        case 'kind-13': {
            return 13;
        }
        default: {
            return -1;
        }
    }
}

// complexity: 12 — eleven decisions and the function's own path, at the cap.
export function weighed(input: number): number {
    let score = 0;
    if (input > 0) {
        score += 1;
    }
    if (input > 1) {
        score += 1;
    }
    if (input > 2) {
        score += 1;
    }
    if (input > 3) {
        score += 1;
    }
    if (input > 4) {
        score += 1;
    }
    if (input > 5) {
        score += 1;
    }
    if (input > 6) {
        score += 1;
    }
    if (input > 7) {
        score += 1;
    }
    if (input > 8) {
        score += 1;
    }
    if (input > 9) {
        score += 1;
    }
    if (input > 10) {
        score += 1;
    }
    return score;
}

// complexity: 12 — twelve decisions and the function's own path, one past the cap.
export function tangled(input: number): number {
    let score = 0;
    if (input > 0) {
        score += 1;
    }
    if (input > 1) {
        score += 1;
    }
    if (input > 2) {
        score += 1;
    }
    if (input > 3) {
        score += 1;
    }
    if (input > 4) {
        score += 1;
    }
    if (input > 5) {
        score += 1;
    }
    if (input > 6) {
        score += 1;
    }
    if (input > 7) {
        score += 1;
    }
    if (input > 8) {
        score += 1;
    }
    if (input > 9) {
        score += 1;
    }
    if (input > 10) {
        score += 1;
    }
    if (input > 11) {
        score += 1;
    }
    return score;
}

// max-lines-per-function: 60 — fifty-five lines, which upstream's 50 would refuse.
export function measured(input: number): number {
    let total = input;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    return total;
}

// max-lines-per-function: 60 — sixty-one lines, one past the cap.
export function overgrown(input: number): number {
    let total = input;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    total += 1;
    return total;
}

// max-lines: 300 — what follows only carries the file past it.
export const STEP_000 = 0;
export const STEP_001 = 1;
export const STEP_002 = 2;
export const STEP_003 = 3;
export const STEP_004 = 4;
export const STEP_005 = 5;
export const STEP_006 = 6;
export const STEP_007 = 7;
export const STEP_008 = 8;
export const STEP_009 = 9;
export const STEP_010 = 10;
export const STEP_011 = 11;
export const STEP_012 = 12;
export const STEP_013 = 13;
export const STEP_014 = 14;
export const STEP_015 = 15;
export const STEP_016 = 16;
export const STEP_017 = 17;
export const STEP_018 = 18;
export const STEP_019 = 19;
export const STEP_020 = 20;
export const STEP_021 = 21;
export const STEP_022 = 22;
export const STEP_023 = 23;
export const STEP_024 = 24;
export const STEP_025 = 25;
export const STEP_026 = 26;
export const STEP_027 = 27;
export const STEP_028 = 28;
export const STEP_029 = 29;
export const STEP_030 = 30;
export const STEP_031 = 31;
export const STEP_032 = 32;
export const STEP_033 = 33;
export const STEP_034 = 34;
export const STEP_035 = 35;
export const STEP_036 = 36;
export const STEP_037 = 37;
export const STEP_038 = 38;
export const STEP_039 = 39;
export const STEP_040 = 40;
export const STEP_041 = 41;
export const STEP_042 = 42;
export const STEP_043 = 43;
export const STEP_044 = 44;
export const STEP_045 = 45;
export const STEP_046 = 46;
export const STEP_047 = 47;
export const STEP_048 = 48;
export const STEP_049 = 49;
export const STEP_050 = 50;
export const STEP_051 = 51;
export const STEP_052 = 52;
export const STEP_053 = 53;
export const STEP_054 = 54;
export const STEP_055 = 55;
export const STEP_056 = 56;
export const STEP_057 = 57;
export const STEP_058 = 58;
export const STEP_059 = 59;
export const STEP_060 = 60;
export const STEP_061 = 61;
export const STEP_062 = 62;
export const STEP_063 = 63;
export const STEP_064 = 64;
export const STEP_065 = 65;
export const STEP_066 = 66;
export const STEP_067 = 67;
export const STEP_068 = 68;
export const STEP_069 = 69;
export const STEP_070 = 70;
export const STEP_071 = 71;
export const STEP_072 = 72;
export const STEP_073 = 73;
export const STEP_074 = 74;
export const STEP_075 = 75;
export const STEP_076 = 76;
export const STEP_077 = 77;
export const STEP_078 = 78;
export const STEP_079 = 79;
export const STEP_080 = 80;
export const STEP_081 = 81;
export const STEP_082 = 82;
export const STEP_083 = 83;
export const STEP_084 = 84;
export const STEP_085 = 85;
export const STEP_086 = 86;
export const STEP_087 = 87;
export const STEP_088 = 88;
export const STEP_089 = 89;
export const STEP_090 = 90;
export const STEP_091 = 91;
export const STEP_092 = 92;
export const STEP_093 = 93;
export const STEP_094 = 94;
export const STEP_095 = 95;
export const STEP_096 = 96;
export const STEP_097 = 97;
export const STEP_098 = 98;
export const STEP_099 = 99;
export const STEP_100 = 100;
export const STEP_101 = 101;
export const STEP_102 = 102;
export const STEP_103 = 103;
export const STEP_104 = 104;
export const STEP_105 = 105;
export const STEP_106 = 106;
export const STEP_107 = 107;
export const STEP_108 = 108;
export const STEP_109 = 109;
export const STEP_110 = 110;
export const STEP_111 = 111;
export const STEP_112 = 112;
export const STEP_113 = 113;
export const STEP_114 = 114;
export const STEP_115 = 115;
export const STEP_116 = 116;
export const STEP_117 = 117;
export const STEP_118 = 118;
export const STEP_119 = 119;
export const STEP_120 = 120;
export const STEP_121 = 121;
export const STEP_122 = 122;
export const STEP_123 = 123;
export const STEP_124 = 124;
export const STEP_125 = 125;
export const STEP_126 = 126;
export const STEP_127 = 127;
export const STEP_128 = 128;
export const STEP_129 = 129;
export const STEP_130 = 130;
export const STEP_131 = 131;
export const STEP_132 = 132;
export const STEP_133 = 133;
export const STEP_134 = 134;
export const STEP_135 = 135;
export const STEP_136 = 136;
export const STEP_137 = 137;
export const STEP_138 = 138;
export const STEP_139 = 139;
export const STEP_140 = 140;
export const STEP_141 = 141;
export const STEP_142 = 142;
export const STEP_143 = 143;
export const STEP_144 = 144;
export const STEP_145 = 145;
export const STEP_146 = 146;
export const STEP_147 = 147;
export const STEP_148 = 148;
export const STEP_149 = 149;
export const STEP_150 = 150;
export const STEP_151 = 151;
export const STEP_152 = 152;
export const STEP_153 = 153;
export const STEP_154 = 154;
export const STEP_155 = 155;
