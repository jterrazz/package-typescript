.PHONY: install build lint test
LINT := npm run lint
CHECKED ::= no

install build:
	npm ci

lint:
	$(LINT)

test::
	npm test

# fix: a comment is not a rule
