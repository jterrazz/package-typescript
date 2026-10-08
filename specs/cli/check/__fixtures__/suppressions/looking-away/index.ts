// eslint-disable-next-line no-unused-vars -- the export is the fixture's point
export const banner = 'ready';

// oxlint-disable-next-line no-unused-vars
export const footer = 'done';

// oxlint-disable-next-line capitalized-comments -- kept from a config that had it on
export const nothing = '';

// @ts-ignore
export const port: number = '8080';

// oxlint-disable-next-line no-console -- the default profile arms the rule, so the directive is live
console.info(banner);

// Stryker disable next-line StringLiteral, all: the banner is read by nothing
export const silenced = banner.length > 0;

// Stryker disable next-line ConditionalExpression :  
export const unreasoned = footer.length > 0;

// Stryker disable next-line ConditionalExpression,EqualityOperator: an empty footer prints the same line
export const declared = footer.length > 0;
