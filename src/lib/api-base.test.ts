import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every `.ts`/`.tsx` file under `src/`, tests excluded. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe('API origin', () => {
  it('is read from the environment in exactly one place', () => {
    // Two clients used to each carry their own fallback, and they drifted
    // (:3333 against the backend's :3337): with no VITE_API_URL set, auth went
    // to a port with nothing on it while the generated hooks were fine, which
    // reads as a login that is simply broken. Now that both import API_BASE,
    // agreement is structural — so what is worth guarding is the structure,
    // not the values, which no assertion about them could catch drifting again.
    const offenders = sourceFiles().filter(
      (file) => !file.endsWith(join('lib', 'api-base.ts')) && readFileSync(file, 'utf8').includes('VITE_API_URL'),
    );

    expect(offenders).toEqual([]);
  });
});
