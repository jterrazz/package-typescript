.PHONY: install build lint fix test check

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

lint: node_modules/.install
	npm run lint

# Every fixer runs, whatever the one before it said, and the verdict is theirs
# Combined, at the end: the toolchain's own, then the test checker's mover.
fix: node_modules/.install
	@status=0; \
	npm run lint:fix || status=1; \
	npx jterrazz-test-check --fix || status=1; \
	exit $$status

test: node_modules/.install
	npm test

check: lint test
