.PHONY: install build lint fix test check check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

lint: build
	npm run lint

# Every fixer runs and the verdict comes at the end, the checker first (docs/06-quality-checks.md, "The six gestures").
fix: build
	@status=0; \
	npx jterrazz-test-check --fix || status=1; \
	npm run lint:fix || status=1; \
	exit $$status

test: build
	npm test

check: lint test

check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# Rewrites the sources in place for its whole run, so nothing else runs beside it; a measure, never a verdict: `check` never calls it.
mutation: build
	npx stryker run
