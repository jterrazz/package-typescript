#!/usr/bin/env node
// A stand-in for Astro's CLI: the consumer it serves holds no template, so `astro check` has nothing to refuse.
process.exit(process.argv[2] === 'check' ? 0 : 1);
