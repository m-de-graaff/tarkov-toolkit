// Builds RaidplannerCompanion.exe via Node's Single Executable Application
// pipeline: esbuild bundles the TS (workspace deps included) into one CJS
// file, node bakes it into a SEA blob, postject injects the blob into a copy
// of the node binary. No signing, no installer — one runnable file.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dist = path.join(root, 'dist');
mkdirSync(dist, { recursive: true });

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

// 1. bundle (esbuild resolves @raidplanner/live's TS source directly)
run(
  `pnpm exec esbuild src/index.ts --bundle --platform=node --format=cjs ` +
    `--outfile=dist/bundle.cjs --external:nothing --log-level=warning`,
);

// 2. SEA blob
writeFileSync(
  path.join(dist, 'sea-config.json'),
  JSON.stringify({
    main: 'dist/bundle.cjs',
    output: 'dist/sea-prep.blob',
    disableExperimentalSEAWarning: true,
  }),
);
run('node --experimental-sea-config dist/sea-config.json');

// 3. copy node binary and inject
const exeName = process.platform === 'win32' ? 'RaidplannerCompanion.exe' : 'raidplanner-companion';
const exePath = path.join(dist, exeName);
copyFileSync(process.execPath, exePath);
run(
  `pnpm dlx postject "${exePath}" NODE_SEA_BLOB dist/sea-prep.blob ` +
    `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
);

console.log(`\nBuilt ${exePath}`);
