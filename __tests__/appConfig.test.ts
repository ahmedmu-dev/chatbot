/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import type { ExpoConfig } from 'expo/config';

import makeConfig from '../app.config';
import appJson from '../app.json';

const ROOT = path.resolve(__dirname, '..');

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

describe('US-1 app config', () => {
  it('AC-2: app is named Parley with id com.ahmedmu.parley on both platforms', () => {
    const { expo } = appJson;
    expect(expo.name).toBe('Parley');
    expect(expo.slug).toBe('parley');
    expect(expo.scheme).toBe('parley');
    expect(expo.android.package).toBe('com.ahmedmu.parley');
    expect(expo.ios.bundleIdentifier).toBe('com.ahmedmu.parley');
  });

  it('AC-2: no leftover old-app names in source, tests, assets, config or package.json', () => {
    // Pattern built from parts so this file does not match itself.
    const pattern = new RegExp(['nect' + 'ar', 'gro' + 'cer'].join('|'), 'i');
    const targets = [
      ...['src', '__tests__', 'assets', '.maestro'].flatMap((d) => files(path.join(ROOT, d))),
      path.join(ROOT, 'app.json'),
      path.join(ROOT, 'package.json'),
    ];
    const offenders = targets.filter(
      (f) =>
        pattern.test(path.relative(ROOT, f)) ||
        (/\.(ts|tsx|json|ya?ml|md)$/.test(f) && pattern.test(fs.readFileSync(f, 'utf8'))),
    );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  describe('BUG-1: cleartext HTTP to the dev proxy', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    afterEach(() => {
      if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = original;
    });

    const build = (url: string | undefined) => {
      if (url === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = url;
      return makeConfig({
        config: appJson.expo as ExpoConfig,
        projectRoot: ROOT,
        staticConfigPath: null,
        packageJsonPath: null,
      });
    };
    const cleartextOf = (cfg: ExpoConfig) =>
      (
        (cfg.plugins as unknown[]).find(
          (p) => Array.isArray(p) && p[0] === 'expo-build-properties',
        ) as [string, { android: { usesCleartextTraffic: boolean } }]
      )[1].android.usesCleartextTraffic;

    it('http:// URL turns Android cleartext on', () => {
      expect(cleartextOf(build('http://192.168.1.22:8787'))).toBe(true);
    });

    it('unset URL (defaults to http://localhost:8787) turns it on', () => {
      expect(cleartextOf(build(undefined))).toBe(true);
    });

    it('https:// URL keeps it off', () => {
      expect(cleartextOf(build('https://proxy.example.com'))).toBe(false);
    });

    it('iOS allows local networking only, never arbitrary loads', () => {
      const ats = build('http://192.168.1.22:8787').ios?.infoPlist?.NSAppTransportSecurity;
      expect(ats).toEqual({ NSAllowsLocalNetworking: true });
    });

    it('keeps the app.json values and existing plugins', () => {
      const cfg = build('https://proxy.example.com');
      expect(cfg.name).toBe('Parley');
      expect(cfg.plugins).toEqual(expect.arrayContaining(['expo-router']));
    });
  });
});
