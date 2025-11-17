#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

interface SpecConfig {
  protocol: string;
  officialPackage: string;
  version: string;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const specPath = path.join(repoRoot, '.github', 'a2a-spec.json');
  const spec = readJson<SpecConfig>(specPath);

  const pkgJsonPath = require.resolve(
    path.join(spec.officialPackage, 'package.json'),
    { paths: [repoRoot] }
  );

  const pkgJson = readJson<{ version: string }>(pkgJsonPath);
  const installedVersion = pkgJson.version;
  const expectedVersion = spec.version;

  if (installedVersion !== expectedVersion) {
    console.error(
      `[A2A spec check] Installed ${spec.officialPackage} version ${installedVersion} ` +
        `does not match expected version ${expectedVersion} from .github/a2a-spec.json.`
    );
    console.error(
      'Either update .github/a2a-spec.json or bump the dependency to the expected version.'
    );
    process.exit(1);
  }

  console.log(
    `[A2A spec check] ${spec.officialPackage} version ${installedVersion} matches expected ${expectedVersion}.`
  );
}

main();