#!/usr/bin/env node
/**
 * Generate latest.json for Tauri auto-updater
 * 
 * Usage: node scripts/generate-latest-json.js v0.2.1
 * 
 * Expects artifacts in ./artifacts/ directory:
 * - Pluto Duck_<version>_aarch64.app.tar.gz
 * - Pluto Duck_<version>_aarch64.app.tar.gz.sig
 * - Pluto Duck_<version>_x64.app.tar.gz
 * - Pluto Duck_<version>_x64.app.tar.gz.sig
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node generate-latest-json.js <version>');
  process.exit(1);
}

const cleanVersion = version.replace(/^v/, '');
const repo = process.env.GITHUB_REPOSITORY || 'Fluxloop-AI/pluto-duck-oss';
const baseUrl = `https://github.com/${repo}/releases/download/${version}`;

const artifactsDir = 'artifacts';

// Find files matching patterns
function findFile(pattern) {
  if (!fs.existsSync(artifactsDir)) {
    console.error(`Artifacts directory not found: ${artifactsDir}`);
    return null;
  }
  
  const files = fs.readdirSync(artifactsDir);
  const match = files.find(f => f.includes(pattern));
  return match ? path.join(artifactsDir, match) : null;
}

// Read signature from .sig file
function readSignature(sigPath) {
  if (!sigPath || !fs.existsSync(sigPath)) {
    console.error(`Signature file not found: ${sigPath}`);
    return '';
  }
  return fs.readFileSync(sigPath, 'utf-8').trim();
}

// Find artifact files
const aarch64TarGz = findFile('aarch64.app.tar.gz');
const aarch64Sig = findFile('aarch64.app.tar.gz.sig');
const x64TarGz = findFile('x64.app.tar.gz');
const x64Sig = findFile('x64.app.tar.gz.sig');

console.log('Found artifacts:');
console.log('  aarch64:', aarch64TarGz);
console.log('  aarch64 sig:', aarch64Sig);
console.log('  x64:', x64TarGz);
console.log('  x64 sig:', x64Sig);

// Build platforms object
const platforms = {};

if (aarch64TarGz && aarch64Sig) {
  const filename = path.basename(aarch64TarGz);
  platforms['darwin-aarch64'] = {
    signature: readSignature(aarch64Sig),
    url: `${baseUrl}/${filename}`,
  };
}

if (x64TarGz && x64Sig) {
  const filename = path.basename(x64TarGz);
  platforms['darwin-x86_64'] = {
    signature: readSignature(x64Sig),
    url: `${baseUrl}/${filename}`,
  };
}

if (Object.keys(platforms).length === 0) {
  console.error('No valid platform artifacts found!');
  process.exit(1);
}

const manifest = {
  version: cleanVersion,
  notes: `See https://github.com/${repo}/releases/tag/${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

// Write output
const outputDir = 'dist-updater';
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'latest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`\nGenerated ${outputPath}:`);
console.log(JSON.stringify(manifest, null, 2));
