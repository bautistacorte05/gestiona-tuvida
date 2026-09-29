// Publica una versión nueva de la app de escritorio en GitHub Releases.
// Uso: subir "version" en electron/package.json y correr `npm run release:win`.
//
// El release se crea primero como borrador a propósito: electron-builder sube el
// instalador y el .blockmap en paralelo y, si el release no existe, cada subida
// intenta crearlo y la segunda falla. Con el borrador ya creado, las dos lo
// encuentran y solo suben archivos. Se publica recién al verificar que estén todos.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const { owner, repo } = pkg.build.publish;
const fullRepo = `${owner}/${repo}`;
const version = JSON.parse(readFileSync('electron/package.json', 'utf8')).version;
const tag = `v${version}`;
const installer = pkg.build.nsis.artifactName.replace('${ext}', 'exe');
const expected = [installer, `${installer}.blockmap`, 'latest.yml'];

const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
const read = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function existingRelease() {
  try {
    return JSON.parse(read(`gh release view ${tag} --repo ${fullRepo} --json isDraft,assets`));
  } catch {
    return null;
  }
}

const existing = existingRelease();
if (existing && !existing.isDraft) {
  console.error(`\nLa versión ${version} ya está publicada. Subí "version" en electron/package.json (por ejemplo a la siguiente) y volvé a correr esto.\n`);
  process.exit(1);
}

const token = read('gh auth token');

run('npm run build:web');
run('npm run desktop:deps');

if (!existing) run(`gh release create ${tag} --repo ${fullRepo} --draft --title ${version} --notes "Gestiona tu vida ${version}"`);

run('npx electron-builder --win --publish always', { GH_TOKEN: token });

const uploaded = (existingRelease()?.assets ?? []).map((a) => a.name);
const missing = expected.filter((name) => !uploaded.includes(name));
if (missing.length) {
  console.error(`\nFaltan archivos en el borrador ${tag}: ${missing.join(', ')}. No se publicó; volvé a correr el comando.\n`);
  process.exit(1);
}

run(`gh release edit ${tag} --repo ${fullRepo} --draft=false --latest`);
console.log(`\nListo: versión ${version} publicada. Las apps instaladas se van a actualizar solas.\n`);
