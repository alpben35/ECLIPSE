import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runCommand(command) {
  console.log(`[Build App Hosting] Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  try {
    console.log('🚀 [Build App Hosting] Starting unified full-stack compilation...');

    // 1. Compile Client Frontend with Vite
    runCommand('npx vite build');

    // 2. Compile Express Backend with Esbuild
    runCommand('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs');

    // 3. Prepare the .apphosting/ bundle directory
    const apphostingDir = path.resolve(__dirname, '.apphosting');
    if (fs.existsSync(apphostingDir)) {
      console.log('🧹 [Build App Hosting] Cleaning existing .apphosting directory...');
      fs.rmSync(apphostingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(apphostingDir, { recursive: true });

    // 4. Create .apphosting/bundle.yaml Configuration
    const bundleYamlContent = `schemaVersion: v1
runConfig:
  runCommand: node dist/server.cjs
`;
    fs.writeFileSync(path.join(apphostingDir, 'bundle.yaml'), bundleYamlContent, 'utf8');
    console.log('📝 [Build App Hosting] Created .apphosting/bundle.yaml configuration.');

    // 5. Copy the fully built dist/ assets to .apphosting/dist/
    const srcDist = path.resolve(__dirname, 'dist');
    const destDist = path.join(apphostingDir, 'dist');
    if (fs.existsSync(srcDist)) {
      console.log('📂 [Build App Hosting] Copying dist/ assets to .apphosting/dist/...');
      copyDir(srcDist, destDist);
    } else {
      throw new Error('CRITICAL: dist directory was not built successfully!');
    }

    // 6. Copy core runtime configuration files to .apphosting/
    const filesToCopy = [
      'package.json',
      'package-lock.json',
      'firebase-applet-config.json',
      'apphosting.yaml'
    ];

    for (const filename of filesToCopy) {
      const srcPath = path.resolve(__dirname, filename);
      if (fs.existsSync(srcPath)) {
        console.log(`📄 [Build App Hosting] Copying ${filename} to .apphosting/`);
        fs.copyFileSync(srcPath, path.join(apphostingDir, filename));
      } else {
        console.warn(`⚠️ [Build App Hosting] Optional/Missing file not copied: ${filename}`);
      }
    }

    console.log('✅ [Build App Hosting] Unified full-stack app successfully bundled into .apphosting!');
  } catch (error) {
    console.error('❌ [Build App Hosting] Build failed with error:', error);
    process.exit(1);
  }
}

build();
