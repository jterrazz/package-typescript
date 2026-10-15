#!/bin/sh
# invariant: the release is tagged before it is published.
tag_release() {
  git tag "$1"
}
