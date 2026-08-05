// Self-update from GitHub releases. A running exe cannot be overwritten on
// Windows, but it can be renamed: download the new exe next to the current
// one, rename current to .old, move new into place, relaunch, exit.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RELEASES_API =
  process.env.RAIDPLANNER_UPDATE_API ??
  'https://api.github.com/repos/m-de-graaff/tarkov-toolkit/releases/latest';
const ASSET_NAME = 'RaidplannerCompanion.exe';

/** returns 1 if a is newer than b, comparing v-prefixed dotted tags */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export interface UpdateInfo {
  tag: string;
  downloadUrl: string;
  /** the release's <asset>.sha256 file; installs REQUIRE it */
  checksumUrl: string | null;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  const response = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'raidplanner-companion' },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const release = (await response.json()) as {
    tag_name?: string;
    assets?: { name: string; browser_download_url: string }[];
  };
  const tag = release.tag_name ?? '';
  const asset = release.assets?.find((a) => a.name === ASSET_NAME);
  if (!tag || !asset) return null;
  const checksum = release.assets?.find((a) => a.name === `${ASSET_NAME}.sha256`);
  return compareVersions(tag, currentVersion) > 0
    ? { tag, downloadUrl: asset.browser_download_url, checksumUrl: checksum?.browser_download_url ?? null }
    : null;
}

/** first sha256-looking hex token of a `<hex>  <filename>` checksum file */
export function parseChecksumFile(text: string): string | null {
  const match = text.match(/\b[0-9a-fA-F]{64}\b/);
  return match ? match[0].toLowerCase() : null;
}

export const sha256Hex = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** delete the leftover from a previous swap, if any */
export function cleanupOldBinary(): void {
  try {
    const old = `${process.execPath}.old`;
    if (existsSync(old)) unlinkSync(old);
  } catch {
    /* still locked by a closing process; next start retries */
  }
}

export async function downloadAndInstall(update: UpdateInfo): Promise<void> {
  const current = process.execPath;
  const incoming = path.join(path.dirname(current), 'RaidplannerCompanion.new.exe');

  // a binary that will replace this exe and auto-run must match the checksum
  // published with its release; no checksum, no install
  if (!update.checksumUrl) {
    throw new Error(`release ${update.tag} publishes no checksum; refusing to install`);
  }
  const checksumResponse = await fetch(update.checksumUrl, {
    headers: { 'User-Agent': 'raidplanner-companion' },
  });
  if (!checksumResponse.ok) throw new Error(`checksum download ${checksumResponse.status}`);
  const expected = parseChecksumFile(await checksumResponse.text());
  if (!expected) throw new Error(`release ${update.tag} checksum file is malformed`);

  const response = await fetch(update.downloadUrl, {
    headers: { 'User-Agent': 'raidplanner-companion' },
  });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const binary = Buffer.from(await response.arrayBuffer());
  const actual = sha256Hex(binary);
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${update.tag}: expected ${expected}, got ${actual}`);
  }
  writeFileSync(incoming, binary);

  renameSync(current, `${current}.old`);
  renameSync(incoming, current);

  spawn(current, [], { detached: true, stdio: 'ignore' }).unref();
  process.exit(0);
}
