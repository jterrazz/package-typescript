import { layers } from '../../engine/compiler/layers.js';

// The dependency arrow points inward: the domain knows nothing, the application knows the domain.
export const HEXAGONAL_MAP = Object.freeze([
    {
        deny: [
            '**/application/**',
            '**/infrastructure/**',
            '**/presentation/**',
            '**/di/**',
            '**/config/**',
            '**/generated/**',
        ],
        files: ['**/domain/**'],
        message: 'the domain layer is pure — it imports no other layer',
        name: 'domain',
    },
    {
        deny: ['**/infrastructure/**', '**/presentation/**', '**/di/**'],
        files: ['**/application/use-cases/**'],
        message: 'a use case depends on the domain and on ports, never on an implementation',
        name: 'application/use-cases',
    },
    {
        deny: ['**/infrastructure/**', '**/presentation/**', '**/di/**'],
        files: ['**/application/ports/**'],
        message: 'a port is an interface — it cannot depend on what implements it',
        name: 'application/ports',
    },
    {
        deny: ['**/infrastructure/outbound/**'],
        files: ['**/infrastructure/inbound/**'],
        message: 'an inbound adapter reaches an outbound one through injection, not by import',
        name: 'infrastructure/inbound',
    },
    {
        deny: ['**/navigation/**'],
        files: ['**/presentation/ui/atoms/**', '**/presentation/ui/molecules/**'],
        message: 'an atom and a molecule are pure — navigation is a feature concern',
        name: 'presentation/ui',
    },
    {
        allow: ['**/presentation/features/common/**'],
        deny: ['**/presentation/features/**'],
        files: ['**/presentation/features/**'],
        message: 'a feature is independent — shared code lives in features/common',
        name: 'presentation/features',
    },
]);

export default layers({ id: 'architecture/hexagonal', map: HEXAGONAL_MAP });
