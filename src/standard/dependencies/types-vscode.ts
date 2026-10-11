import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        manifestKeys: [
            'activationEvents',
            'badges',
            'capabilities',
            'categories',
            'contributes',
            'displayName',
            'extensionDependencies',
            'extensionKind',
            'extensionPack',
            'galleryBanner',
            'icon',
            'l10n',
            'markdown',
            'preview',
            'publisher',
            'qna',
            'sponsor',
        ],
    },
});
