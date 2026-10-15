// electron/main.js
const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

const APP_SCHEME = 'app';
const APP_HOST = 'pcc';
const APP_BASE_URL = `${APP_SCHEME}://${APP_HOST}/`;

// Register custom scheme with standard, secure, and fetch privileges
// to provide a permanent, stable origin (app://pcc) for localStorage and IndexedDB.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;

function log(...args) {
  console.log('[Electron Shell]', ...args);
}

// Single instance enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Find directory with static build output
function resolveStaticDirectory() {
  if (process.env.STATIC_DIR && fs.existsSync(process.env.STATIC_DIR)) {
    log(`Using STATIC_DIR from env: ${process.env.STATIC_DIR}`);
    return process.env.STATIC_DIR;
  }

  const candidates = [];

  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app', 'out'),
      path.join(process.resourcesPath, 'out'),
      path.join(process.resourcesPath, 'app', 'dist'),
      path.join(process.resourcesPath, 'dist')
    );
  } else {
    candidates.push(
      path.join(__dirname, '../out'),
      path.join(__dirname, '../dist'),
      path.join(__dirname, 'placeholder')
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      log(`Found static bundle directory: ${candidate}`);
      return candidate;
    }
  }

  const fallback = path.join(__dirname, 'placeholder');
  log(`Fallback to placeholder directory: ${fallback}`);
  return fallback;
}

function setupProtocolHandler(staticDir) {
  protocol.handle(APP_SCHEME, (request) => {
    const parsedUrl = new URL(request.url);
    let pathname = decodeURIComponent(parsedUrl.pathname || '/');

    // Prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(staticDir, safePath);

    function resolveFile(candidate) {
      try {
        if (fs.existsSync(candidate)) {
          const stat = fs.statSync(candidate);
          if (stat.isFile()) return candidate;
          if (stat.isDirectory()) {
            const indexFile = path.join(candidate, 'index.html');
            if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
              return indexFile;
            }
          }
        }
      } catch (e) {}
      return null;
    }

    let resolved = resolveFile(filePath);

    // Next.js static export route conventions: /dashboard -> /dashboard.html
    if (!resolved && !path.extname(filePath)) {
      resolved = resolveFile(filePath + '.html');
    }

    // SPA fallback to index.html for client-side routing
    if (!resolved) {
      resolved = resolveFile(path.join(staticDir, 'index.html'));
    }

    if (!resolved) {
      return new Response('Not Found', { status: 404 });
    }

    return net.fetch(url.pathToFileURL(resolved).toString());
  });
}

function createMainWindow(targetUrl) {
  const iconPath = path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    title: 'Personal Command Center',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http:') || target.startsWith('https:')) {
      shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(targetUrl);
  return mainWindow;
}

app.whenReady().then(async () => {
  const staticDir = resolveStaticDirectory();
  log(`Serving static content from: ${staticDir} via ${APP_SCHEME}://${APP_HOST}`);

  try {
    setupProtocolHandler(staticDir);
    createMainWindow(APP_BASE_URL);
  } catch (err) {
    console.error('Failed to initialize app protocol / window:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
