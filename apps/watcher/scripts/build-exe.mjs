// Builds RaidplannerCompanion.exe via Node's Single Executable Application
// pipeline: esbuild bundles the TS (workspace deps included) into one CJS
// file, node bakes it into a SEA blob, postject injects the blob into a copy
// of the node binary. No signing, no installer - one runnable file.
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
const version = process.env.RELEASE_TAG ?? 'dev';
run(
  `pnpm exec esbuild src/index.ts --bundle --platform=node --format=cjs ` +
    `--outfile=dist/bundle.cjs --external:nothing --log-level=warning ` +
    `--define:__COMPANION_VERSION__='"${version}"'`,
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

// 3. copy node binary, brand it, and inject
const exeName = process.platform === 'win32' ? 'RaidplannerCompanion.exe' : 'raidplanner-companion';
const exePath = path.join(dist, exeName);
copyFileSync(process.execPath, exePath);

// 3a. icon + version resources (before injection, so the blob is appended to
// a finished resource section). The tray icon is extracted from the exe, so
// this brands both the file and the notification area.
if (process.platform === 'win32') {
  const { rcedit } = await import('rcedit');
  const tag = process.env.RELEASE_TAG ?? '';
  const numeric = /^v\d+\.\d+\.\d+$/.test(tag) ? tag.slice(1) : '0.0.0';
  await rcedit(exePath, {
    icon: path.join(root, 'assets', 'companion.ico'),
    'product-version': numeric,
    'file-version': numeric,
    'version-string': {
      ProductName: 'Tarkov Toolkit Companion',
      FileDescription: 'Tarkov Toolkit Companion - live raid position and quest automation',
      LegalCopyright: 'MIT License',
      OriginalFilename: exeName,
    },
  });
  console.log('Embedded icon and version resources.');
}

run(
  `pnpm dlx postject "${exePath}" NODE_SEA_BLOB dist/sea-prep.blob ` +
    `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
);

// 4. drop the console window: flip the PE subsystem from console (3) to GUI (2)
// so the packaged app runs tray-only. Offsets: e_lfanew at 0x3C points at the
// PE signature; Subsystem is a uint16 at optional-header offset 68.
if (process.platform === 'win32') {
  const { readFileSync: read, writeFileSync: write } = await import('node:fs');
  const exe = read(exePath);
  const peOffset = exe.readUInt32LE(0x3c);
  if (exe.readUInt32LE(peOffset) !== 0x00004550) throw new Error('not a PE file');
  const optionalHeaderOffset = peOffset + 4 + 20;
  const subsystemOffset = optionalHeaderOffset + 68;
  const subsystem = exe.readUInt16LE(subsystemOffset);
  if (subsystem !== 2 && subsystem !== 3) throw new Error(`unexpected subsystem ${subsystem}`);
  exe.writeUInt16LE(2, subsystemOffset);
  write(exePath, exe);
  console.log('Patched to GUI subsystem (no console window).');
}

console.log(`\nBuilt ${exePath} (version ${version})`);
