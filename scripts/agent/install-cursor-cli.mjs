import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED = ['version', 'url', 'sha256', 'model'];

export function parseVersionFile(text) {
  const entries = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) throw new Error('Invalid cursor-cli.version line');
    entries[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  for (const key of REQUIRED) {
    if (!entries[key]) throw new Error(`cursor-cli.version is missing ${key}`);
  }
  if (!/^[a-f0-9]{64}$/.test(entries.sha256)) {
    throw new Error('cursor-cli.version sha256 must be 64 hex characters');
  }
  return entries;
}

export function assertChecksum(actual, expected) {
  if (actual !== expected) {
    throw new Error('Cursor CLI checksum mismatch');
  }
}

export async function installCursorCli(destination, versionFile = new URL('./cursor-cli.version', import.meta.url)) {
  const pin = parseVersionFile(await readFile(versionFile, 'utf8'));
  const response = await fetch(pin.url);
  if (!response.ok) {
    throw new Error(`Cursor CLI download failed with status ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  assertChecksum(actual, pin.sha256);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const archive = path.join(tmpdir(), `cursor-cli-${pin.version}.tar.gz`);
  await writeFile(archive, bytes);
  try {
    execFileSync('tar', ['--strip-components=1', '-xzf', archive, '-C', destination], { stdio: 'inherit' });
  } finally {
    await rm(archive, { force: true });
  }
  return { bin: path.join(destination, 'cursor-agent'), pin };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const destination = process.argv[2];
  if (!destination) {
    console.error('usage: node scripts/agent/install-cursor-cli.mjs <destination>');
    process.exit(1);
  }
  const { bin, pin } = await installCursorCli(destination);
  console.error(`installed Cursor CLI ${pin.version}`);
  console.log(bin);
}
