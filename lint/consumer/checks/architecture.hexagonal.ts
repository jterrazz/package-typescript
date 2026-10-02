import type { ArchitectureRule } from '../../engine/project/preset.js';

const READ = 'docs/07-quality-checks.md#the-hexagonal-map';

const ANY_DEPTH = '(^|/)';

export const ARCHITECTURE_HEXAGONAL: readonly ArchitectureRule[] = Object.freeze([
    {
        fix: 'move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it',
        from: { path: `${ANY_DEPTH}domain/` },
        name: 'hexagonal-domain-is-pure',
        read: READ,
        to: { path: `${ANY_DEPTH}(application|infrastructure|presentation|di|config|generated)/` },
        why: 'the domain layer is pure — it imports no other layer',
    },
    {
        fix: 'depend on the port the implementation satisfies, and let the composition root hand the implementation in',
        from: { path: `${ANY_DEPTH}application/use-cases/` },
        name: 'hexagonal-use-case-reaches-ports',
        read: READ,
        to: { path: `${ANY_DEPTH}(infrastructure|presentation|di)/` },
        why: 'a use case depends on the domain and on ports, never on an implementation',
    },
    {
        fix: 'state the shape the port needs in the port itself, in domain terms',
        from: { path: `${ANY_DEPTH}application/ports/` },
        name: 'hexagonal-port-knows-no-implementation',
        read: READ,
        to: { path: `${ANY_DEPTH}(infrastructure|presentation|di)/` },
        why: 'a port is an interface — it cannot depend on what implements it',
    },
    {
        fix: 'take the outbound adapter as a constructor argument, wired by the composition root',
        from: { path: `${ANY_DEPTH}infrastructure/inbound/` },
        name: 'hexagonal-inbound-injects-outbound',
        read: READ,
        to: { path: `${ANY_DEPTH}infrastructure/outbound/` },
        why: 'an inbound adapter reaches an outbound one through injection, not by import',
    },
    {
        fix: 'hand the atom or molecule a callback, and let the feature that renders it navigate',
        from: { path: `${ANY_DEPTH}presentation/ui/(atoms|molecules)/` },
        name: 'hexagonal-ui-stays-pure',
        read: READ,
        to: { path: `${ANY_DEPTH}navigation/` },
        why: 'an atom and a molecule are pure — navigation is a feature concern',
    },
    {
        fix: 'move what two features share into `presentation/features/common/`',
        from: { path: `${ANY_DEPTH}presentation/features/([^/]+)/` },
        name: 'hexagonal-feature-is-independent',
        read: READ,
        to: {
            path: `${ANY_DEPTH}presentation/features/`,
            pathNot: `${ANY_DEPTH}presentation/features/(common|$2)/`,
        },
        why: 'a feature is independent — shared code lives in features/common',
    },
]);
