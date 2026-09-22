import { allOn, fragment } from './_contract.js';

/*
 * The `jsx-a11y` plugin, all 36 rules on. There is no off here and no reason
 * to record: an accessibility rule describes what a person using the product
 * can reach, and the estate has no profile that may decide otherwise.
 */
export default fragment({
    id: 'a11y',
    plugins: ['jsx-a11y'],
    rules: allOn(
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
            'no-noninteractive-tabindex',
            'no-redundant-roles',
            'no-static-element-interactions',
            'prefer-tag-over-role',
            'role-has-required-aria-props',
            'role-supports-aria-props',
            'scope',
            'tabindex-no-positive',
        ].map((rule) => `jsx-a11y/${rule}`),
    ),
});
