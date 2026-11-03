/// <reference types="node" />
import fs from 'fs';
import path from 'path';

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
});
