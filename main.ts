// SHADOWLINE's hand-in program: it copies game/ and the screenshots named
// in shots.json into the output directory and writes dossier.json with
// buildDossier from vendor/makefun-game.ts. Node 22 standard library only,
// no network, deterministic: two runs write the same bytes.
//
// The screenshots trap: the screenshot harness writes report.json into
// screenshots/, and the dossier refuses more than 4 images. So this
// program copies ONLY the shots named in shots.json (falling back to the
// whole directory only when shots.json is absent).

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyGame() {
  const src = join(root, 'game');
  const dst = join(outDir, 'game');
  cpSync(src, dst, { recursive: true });
}

function copyScreenshots() {
  const srcDir = join(root, 'screenshots');
  const dstDir = join(outDir, 'screenshots');
  mkdirSync(dstDir, { recursive: true });
  const manifestPath = join(root, 'shots.json');
  if (existsSync(manifestPath)) {
    const shots = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const shot of shots) {
      const name = shot.name;
      if (typeof name !== 'string' || name.includes('/') || name.includes('..')) {
        throw new Error(`main.ts: shots.json names an unsafe file: ${name}`);
      }
      cpSync(join(srcDir, name), join(dstDir, name));
    }
    return;
  }
  cpSync(srcDir, dstDir, { recursive: true });
}

function emptyDir(dir: string) {
  // Empty a directory without removing the directory itself: the grader
  // mounts /output, and removing a mount point fails with EBUSY.
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main() {
  emptyDir(outDir);
  copyGame();
  copyScreenshots();
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
