#!/usr/bin/env node
// A stand-in for Astro's CLI: the consumer it serves holds no template, so `astro sync` has no module type to write and `astro check` nothing to refuse.
process.exit(['check', 'sync'].includes(process.argv[2] ?? '') ? 0 : 1);
