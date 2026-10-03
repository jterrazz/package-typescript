.PHONY: install build install-self lint fix test check check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

# The repository installs itself (`file:.`) as a copy of its tarball: laid again from this build's, so what the specs and @jterrazz/test load from node_modules is what a consumer installs.
install-self: build
	@rm -rf .artifacts/self node_modules/@jterrazz/typescript
	@mkdir -p .artifacts/self node_modules/@jterrazz/typescript
	@npm pack --ignore-scripts --silent --pack-destination .artifacts/self > /dev/null
	@tar -xzf .artifacts/self/*.tgz --strip-components=1 -C node_modules/@jterrazz/typescript

lint: install-self
	npm run lint

fix: build
	npm run lint:fix

test: install-self
	npm test

check: lint test

check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# Minutes to hours where `check` takes seconds, so `check` never calls it.
mutation: build
	node dist/typescript.js mutation
