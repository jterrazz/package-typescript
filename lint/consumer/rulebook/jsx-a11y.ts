import { allOn, fragment, off, on } from '../../kit/compiler/decision.js';

// invariant: an accessibility rule describes what a person using the product can reach, so an off here cites the measured false positive it ends.
export default fragment({
    id: 'jsx-a11y',
    audience: 'consumer',
    plugins: ['jsx-a11y'],
    rules: {
        ...allOn(
            [
                'alt-text',
                'anchor-ambiguous-text',
                'anchor-has-content',
                'anchor-is-valid',
                'aria-activedescendant-has-tabindex',
                'aria-props',
                'aria-proptypes',
                'aria-role',
                'aria-unsupported-elements',
                'autocomplete-valid',
                'click-events-have-key-events',
                'control-has-associated-label',
                'heading-has-content',
                'html-has-lang',
                'iframe-has-title',
                'img-redundant-alt',
                'interactive-supports-focus',
                'label-has-associated-control',
                'lang',
                'media-has-caption',
                'mouse-events-have-key-events',
                'no-access-key',
                'no-aria-hidden-on-focusable',
                'no-autofocus',
                'no-distracting-elements',
                'no-interactive-element-to-noninteractive-role',
                'no-noninteractive-element-interactions',
                'no-noninteractive-element-to-interactive-role',
                'no-redundant-roles',
                'no-static-element-interactions',
                'role-has-required-aria-props',
                'role-supports-aria-props',
                'scope',
                'tabindex-no-positive',
            ].map((rule) => `jsx-a11y/${rule}`),
        ),
        'jsx-a11y/prefer-tag-over-role': off(
            {
                by: 'an accessible SVG is `<svg role="img">` with a title, which the rule reads as a request for an `<img>` it cannot be, and the rule takes no option; no-redundant-roles, role-supports-aria-props and no-static-element-interactions still hold the roles a tag already carries (signews-web, 2026-10-10)',
                kind: 'evidence',
            },
            '11.0.0',
        ),
        // outside: a scrollable region must be reachable by the keyboard (WCAG 2.1.1, axe scrollable-region-focusable): a `<section>`, the tag prefer-tag-over-role asks for a region, takes `tabIndex={0}`, and jterrazz-typescript/focusable-section-is-labelled holds it to the label that makes it one.
        'jsx-a11y/no-noninteractive-tabindex': {
            ...on([{ roles: ['tabpanel', 'region'], tags: ['section'] }]),
            since: '11.0.0',
        },
    },
});
