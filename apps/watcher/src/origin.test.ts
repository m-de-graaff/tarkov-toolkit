import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './origin.ts';

describe('isAllowedOrigin', () => {
  it('allows the hosted app and local dev', () => {
    expect(isAllowedOrigin('https://tarkovtoolkit.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://tarkov-toolkit.vercel.app')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('allows non-browser clients (no Origin header)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });

  it('rejects every other website', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('http://localhost:8080')).toBe(false);
    expect(isAllowedOrigin('null')).toBe(false); // sandboxed iframe origin
  });

  it('extends via the env allow-list', () => {
    expect(isAllowedOrigin('https://my.domain', 'https://my.domain, https://other')).toBe(true);
    expect(isAllowedOrigin('https://other', 'https://my.domain,https://other')).toBe(true);
    expect(isAllowedOrigin('https://evil.example', 'https://my.domain')).toBe(false);
  });
});
