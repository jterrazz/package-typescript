import type { ArchitectureRule } from '../../kit/project/preset.js';

const READ = 'docs/reference/quality-checks.md#the-hexagonal-map';

const ANY_DEPTH = '(^|/)';

const SOURCE = String.raw`\.[cm]?[jt]sx?$`;

const APP_ENTRY = `${ANY_DEPTH}src/index${SOURCE}`;

const SPEC_RUNNER = String.raw`${ANY_DEPTH}specs/.*\.specification${SOURCE}`;

export const ARCHITECTURE_HEXAGONAL: readonly ArchitectureRule[] = Object.freeze([
    {
        fix: 'move what it needs into the domain, or declare a port the domain owns and let an outer layer implement it',
        from: { path: `${ANY_DEPTH}domain/` },
        name: 'hexagonal-domain-is-pure',
        read: READ,
        to: {
            path: `${ANY_DEPTH}(application|composition|infrastructure|presentation|config|generated)/`,
        },
        why: 'the domain layer is pure — it imports no other layer',
    },
    {
        fix: 'depend on the port the implementation satisfies, and let the composition root hand the implementation in',
        from: { path: `${ANY_DEPTH}application/use-cases/` },
        name: 'hexagonal-use-case-reaches-ports',
        read: READ,
        to: { path: `${ANY_DEPTH}(composition|infrastructure|presentation)/` },
        why: 'a use case depends on the domain and on ports, never on an implementation',
    },
    {
        fix: 'state the shape the port needs in the port itself, in domain terms',
        from: { path: `${ANY_DEPTH}application/ports/` },
        name: 'hexagonal-port-knows-no-implementation',
        read: READ,
        to: { path: `${ANY_DEPTH}(composition|infrastructure|presentation)/` },
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
        fix: 'name the port it needs and let `composition/` hand the implementation in',
        from: {
            pathNot: [
                `${ANY_DEPTH}(application/(use-cases|ports)|composition|domain|infrastructure)/`,
                `${ANY_DEPTH}specs/`,
            ],
        },
        name: 'hexagonal-composition-wires-infrastructure',
        read: READ,
        to: { path: `${ANY_DEPTH}infrastructure/` },
        why: '`composition/` is the one layer that builds an implementation and hands it to the application',
    },
    {
        fix: 'take what it needs as a constructor argument, and let the app entry or the spec runner call `compose()`',
        from: { pathNot: [`${ANY_DEPTH}composition/`, APP_ENTRY, SPEC_RUNNER] },
        name: 'hexagonal-composition-is-the-root',
        read: READ,
        to: { path: `${ANY_DEPTH}composition/` },
        why: 'the composition root builds the app once, for the process entry and for a spec runner; a module that reached it would depend on the whole graph',
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
