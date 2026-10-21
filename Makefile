.PHONY: install build install-self lint fix test check check-links mutation rehearse

# invariant: the stamp depends on the packed toolchain tarballs as well as the manifest and the lockfile, so an edited manifest or a package packed again under the same name is installed again, never run against yesterday's build.
# invariant: an install replaces the dependencies a running gate reads, so every path that installs (`install`, and any target that depends on `node_modules/.install`) asks the toolchain's `gate-lock` first, which refuses while another gate holds `.artifacts/gate.lock`; a checkout with no install yet holds no gate.
node_modules/.install: package.json package-lock.json $(wildcard .artifacts/packages/*.tgz)
	@if [ -d node_modules ] && [ -f dist/typescript.js ]; then node dist/typescript.js gate-lock; fi
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

# invariant: the repository installs itself (`file:.`) as a copy of its tarball, laid again from this build's, so what the specs and @jterrazz/test load from node_modules is what a consumer installs.
install-self: build
	@rm -rf .artifacts/self node_modules/@jterrazz/typescript
	@mkdir -p .artifacts/self node_modules/@jterrazz/typescript
	@npm pack --ignore-scripts --silent --pack-destination .artifacts/self > /dev/null
	@tar -xzf .artifacts/self/*.tgz --strip-components=1 -C node_modules/@jterrazz/typescript

lint: install-self
	npm run lint

fix: install-self
	npm run lint:fix

test: install-self
	node dist/typescript.js test

# invariant: the three steps are one gate: `TYPESCRIPT_GATE` names this recipe's shell, which `check` and `mutation` hold the checkout in the name of, and whose own builds the lock never refuses.
check: node_modules/.install
	@TYPESCRIPT_GATE=$$$$:$(CURDIR) $(MAKE) --no-print-directory lint test mutation

check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# value: incremental: only the mutants whose source, covering tests or their ground changed since the report left in .artifacts/stryker/ run again, on every host alike; `MUTATION_ARGS=--cold` starts both runs from no report, as a host that restores none does by itself.
mutation: build
	node dist/typescript.js mutation $(MUTATION_ARGS)

# outside: needs docker and the network; `check` never calls it, and a release runs it on its commit before the tag.
rehearse: build
	node dist/typescript.js rehearse $(REHEARSE_ARGS)
