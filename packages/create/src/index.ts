#!/usr/bin/env node
import { main } from 'tenhaw';
main(['init', ...process.argv.slice(2)]).catch(() => {
  process.stderr.write('Scaffolding failed. Use npm create tenhaw -- <template> <new-directory>. Existing files are never overwritten.\n');
  process.exitCode = 1;
});
