.PHONY: install build lint fix test check

install:
	npm install

build:
	npm run build

lint:
	npx typescript check

fix:
	npx typescript fix

test:
	npm test

check: build lint test
