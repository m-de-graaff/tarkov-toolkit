import { describe, expect, it } from 'vitest';
import { compareVersions, parseChecksumFile, sha256Hex } from './updater.ts';

describe('compareVersions', () => {
  it.each([
    ['v1.2.3', 'v1.2.2', 1],
    ['v1.2.3', 'v1.2.3', 0],
    ['v1.2.3', 'v1.2.4', -1],
    ['v2.0.0', 'v1.9.9', 1],
    ['v1.10.0', 'v1.9.0', 1], // numeric, not lexicographic
    ['1.0.0', 'v1.0.0', 0], // prefix optional
    ['v1.2', 'v1.2.0', 0], // missing segments are zero
    ['dev', 'v0.0.1', -1], // unparsable counts as 0.0.0
  ])('%s vs %s -> %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});

describe('parseChecksumFile', () => {
  const hex = 'a'.repeat(64);

  it('reads `<hex>  <filename>` sha256sum format', () => {
    expect(parseChecksumFile(`${hex}  RaidplannerCompanion.exe\n`)).toBe(hex);
  });

  it('reads a bare hash and normalizes case', () => {
    expect(parseChecksumFile(`${'A'.repeat(64)}`)).toBe(hex);
  });

  it('rejects files without a sha256', () => {
    expect(parseChecksumFile('not a checksum')).toBeNull();
    expect(parseChecksumFile(`${'a'.repeat(40)}  file.exe`)).toBeNull(); // sha1 length
  });
});

describe('sha256Hex', () => {
  it('hashes to lowercase hex', () => {
    // well-known vector: sha256("abc")
    expect(sha256Hex(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
