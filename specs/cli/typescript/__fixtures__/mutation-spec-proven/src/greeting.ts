const name = process.argv[2] ?? 'world';

process.stdout.write(name === '' ? 'hello, nobody\n' : `hello, ${name}\n`);
