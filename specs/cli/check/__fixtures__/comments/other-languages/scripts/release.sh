#!/bin/sh
# shellcheck disable=SC2086
# hazard: the tag is pushed before the package, so a failed publish leaves a tag to delete
# by hand before the next run
set -eu
# Bump the version
npm version patch
cat <<NOTES
# not a comment: the heading of the notes
NOTES
