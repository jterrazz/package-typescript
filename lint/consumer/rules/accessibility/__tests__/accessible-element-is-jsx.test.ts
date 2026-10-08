import { ruleTester } from '@jterrazz/test';

import { accessibleElementIsJsx } from '../accessible-element-is-jsx.js';

const FILENAME = '/nowhere/src/scroll-region.tsx';

ruleTester().run('accessible-element-is-jsx', accessibleElementIsJsx, {
    invalid: [
        {
            code: "export const Short = (role) => createElement('div', { role, 'tabIndex': 0 });",
            errors: [
                { column: 54, data: { prop: 'role' }, line: 1, messageId: 'hidden' },
                { column: 60, data: { prop: 'tabIndex' }, line: 1, messageId: 'hidden' },
            ],
            filename: FILENAME,
        },
        {
            code: "export const Region = ({ as, label }) => createElement(as, { 'aria-label': label, role: 'region', tabIndex: 0 });",
            errors: [
                { column: 61, data: { prop: 'aria-label' }, line: 1, messageId: 'hidden' },
                { column: 82, data: { prop: 'role' }, line: 1, messageId: 'hidden' },
                { column: 98, data: { prop: 'tabIndex' }, line: 1, messageId: 'hidden' },
            ],
            filename: FILENAME,
        },
        {
            code: "export const Tab = () => React.createElement('div', { tabIndex: -1 });",
            errors: [{ column: 54, data: { prop: 'tabIndex' }, line: 1, messageId: 'hidden' }],
            filename: FILENAME,
        },
    ],
    valid: [
        {
            code: "export const Rest = (rest) => createElement('div', { ...rest, className: 'strip' });",
            filename: FILENAME,
        },
        {
            code: "export const Named = (role) => createElement('div', { [role]: 'x', roles: [], tabIndexes: 1, 'data-role': 'x', 1: 'x' });",
            filename: FILENAME,
        },
        { code: "export const Made = () => factory()('div', { role: 'x' });", filename: FILENAME },
        { code: "export const Bare = () => createElement('div');", filename: FILENAME },
        {
            code: "export const Plain = ({ as }) => createElement(as, { className: 'strip' });",
            filename: FILENAME,
        },
        { code: "export const node = document.createElement('div');", filename: FILENAME },
        {
            code: 'export const Spread = ({ as, props }) => createElement(as, props);',
            filename: FILENAME,
        },
        {
            code: 'export const Region = () => <section aria-label="Source" tabIndex={0} />;',
            filename: FILENAME,
        },
        {
            code: "export const Computed = (key) => createElement('div', { [key]: 0 });",
            filename: FILENAME,
        },
        {
            code: "export const value = registry['createElement']('div', { role: 'x' });",
            filename: FILENAME,
        },
    ],
});
