.PHONY: install build lint fix test check

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

lint: node_modules/.install
	npm run lint

# Every fixer runs and the verdict comes at the end, the checker first (docs/06-quality-checks.md, "The six gestures").
fix: node_modules/.install
	@status=0; \
	npx jterrazz-test-check --fix || status=1; \
	npm run lint:fix || status=1; \
	exit $$status

test: node_modules/.install
	npm test

check: lint test
