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
    console.log('[Build App Hosting] Starting unified full-stack packaging...');

    // 3. Prepare the .apphosting/ bundle directory
    const apphostingDir = path.resolve(__dirname, '.apphosting');
    if (fs.existsSync(apphostingDir)) {
      console.log('[Build App Hosting] Cleaning existing .apphosting directory...');
      fs.rmSync(apphostingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(apphostingDir, { recursive: true });

    // 4. Create .apphosting/bundle.yaml Configuration
    const bundleYamlContent = `schemaVersion: v1
runConfig:
  runCommand: node dist/server.cjs
`;
    fs.writeFileSync(path.join(apphostingDir, 'bundle.yaml'), bundleYamlContent, 'utf8');
    console.log('[Build App Hosting] Created .apphosting/bundle.yaml configuration.');

    // 5. Copy the fully built dist/ assets to .apphosting/dist/
    const srcDist = path.resolve(__dirname, 'dist');
    const destDist = path.join(apphostingDir, 'dist');
    if (fs.existsSync(srcDist)) {
      console.log('[Build App Hosting] Copying dist/ assets to .apphosting/dist/...');
      copyDir(srcDist, destDist);
    } else {
      throw new Error('CRITICAL: dist directory was not built successfully!');
    }

    // Copy local override dependency if it exists
    const srcShim = path.resolve(__dirname, 'node-domexception-shim');
    const destShim = path.join(apphostingDir, 'node-domexception-shim');
    if (fs.existsSync(srcShim)) {
      console.log('[Build App Hosting] Copying local DOM override...');
      copyDir(srcShim, destShim);
    }

    // 6. Copy core runtime configuration files to .apphosting/
    const filesToCopy = [
      'package.json',
      'firebase-applet-config.json',
      'apphosting.yaml'
    ];

    for (const filename of filesToCopy) {
      const srcPath = path.resolve(__dirname, filename);
      if (fs.existsSync(srcPath)) {
        console.log(`[Build App Hosting] Copying ${filename} to .apphosting/`);
        fs.copyFileSync(srcPath, path.join(apphostingDir, filename));
      } else {
        console.warn(`[Build App Hosting] Optional/Missing file not copied: ${filename}`);
      }
    }

    // 7. Copy computed server.cjs bundle for cloud functions compatibility
    const functionsServerDest = path.resolve(__dirname, 'backend/functions/server.cjs');
    const compiledServerSource = path.resolve(__dirname, 'dist/server.cjs');
    if (fs.existsSync(compiledServerSource)) {
      console.log('[Build Functions] Copying dist/server.cjs into backend/functions/server.cjs...');
      fs.copyFileSync(compiledServerSource, functionsServerDest);
    } else {
      console.warn('[Build Functions] Compiled server bundle not found; skipping copy to cloud functions directory.');
    }

    // 8. Copy firebase-applet-config.json to backend/functions and dist folder for backend config & API key runtime fallback on the website
    const configSource = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configSource)) {
      const functionsConfigDest = path.resolve(__dirname, 'backend/functions/firebase-applet-config.json');
      console.log('[Build Functions] Copying firebase-applet-config.json to backend/functions/firebase-applet-config.json...');
      fs.copyFileSync(configSource, functionsConfigDest);

      const distConfigDest = path.resolve(__dirname, 'dist/firebase-applet-config.json');
      console.log('[Build App Hosting] Copying firebase-applet-config.json to dist/firebase-applet-config.json...');
      fs.copyFileSync(configSource, distConfigDest);
    } else {
      console.warn('[Build App Hosting] Warn: firebase-applet-config.json not found, skipping fallback copying.');
    }

    console.log('[Build App Hosting] Unified full-stack app successfully bundled into .apphosting!');
  } catch (error) {
    console.error('[Build App Hosting] Build failed with error:', error);
    process.exit(1);
  }
}

build();
