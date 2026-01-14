#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read package.json to get version
const packageJsonPath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const newVersion = packageJson.version;

// Update tauri.conf.json
const tauriConfPath = path.join(__dirname, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);
console.log(`Updated tauri.conf.json to v${newVersion}`);

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, "src-tauri", "Cargo.toml");
let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`Updated Cargo.toml to v${newVersion}`);

console.log(`✓ All versions synced to v${newVersion}`);
