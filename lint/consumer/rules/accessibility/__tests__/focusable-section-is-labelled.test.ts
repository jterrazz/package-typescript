import { ruleTester } from '@jterrazz/test';

import { focusableSectionIsLabelled } from '../focusable-section-is-labelled.js';

const FILENAME = '/nowhere/src/listing.tsx';

ruleTester().run('focusable-section-is-labelled', focusableSectionIsLabelled, {
    invalid: [
        {
            code: 'export const Strip = () => <section tabIndex={0}><pre /></section>;',
            errors: [{ column: 27, line: 1, messageId: 'unlabelled' }],
            filename: FILENAME,
        },
        {
            code: 'export const Strip = () => <section title="Source" tabIndex="0" />;',
            errors: [{ column: 27, line: 1, messageId: 'unlabelled' }],
            filename: FILENAME,
        },
        {
            code: 'export const Strip = () => <section tabIndex />;',
            errors: [{ column: 27, line: 1, messageId: 'unlabelled' }],
            filename: FILENAME,
        },
        {
            code: 'export const Strip = () => <section tabIndex={+1} />;',
            errors: [{ column: 27, line: 1, messageId: 'unlabelled' }],
            filename: FILENAME,
        },
    ],
    valid: [
        {
            code: 'export const Labelled = () => <section aria-label="Source" />;',
            filename: FILENAME,
        },
        {
            code: 'export const Listing = () => <section aria-label="Source" tabIndex={0} />;',
            filename: FILENAME,
        },
        {
            code: 'export const Listing = () => <section aria-labelledby="source-title" tabIndex={0} />;',
            filename: FILENAME,
        },
        { code: 'export const Plain = () => <section><pre /></section>;', filename: FILENAME },
        {
            code: 'export const Target = () => <section id="explore" tabIndex={-1} />;',
            filename: FILENAME,
        },
        {
            code: 'export const Target = () => <section id="explore" tabIndex="-1" />;',
            filename: FILENAME,
        },
        {
            code: 'export const Spread = (props) => <section {...props} tabIndex={0} />;',
            filename: FILENAME,
        },
        {
            code: 'export const Other = () => <div tabIndex={0} role="region" aria-label="x" />;',
            filename: FILENAME,
        },
        { code: 'export const Member = () => <ui.section tabIndex={0} />;', filename: FILENAME },
    ],
});
