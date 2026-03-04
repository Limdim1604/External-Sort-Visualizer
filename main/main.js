/**
 * ============================================================
 *  External Sort Visualizer – Electron Main Process
 * ============================================================
 *  Responsibilities:
 *   • Create the BrowserWindow
 *   • Handle IPC for file dialogs and algorithm execution
 *   • NEVER expose Node/fs to the renderer
 * ============================================================
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

// Algorithm module (pure logic, no UI)
const {
  twoWayExternalMergeSort,
  bWayExternalMergeSort,
  repackingExternalMergeSort,
  generateDemoFile,
} = require('../algorithms/externalSort');

/* ── helpers ─────────────────────────────────────────────── */

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'External Sort Visualizer',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,   // security
      nodeIntegration:  false,  // security
    },
  });

  if (isDev) {
    // In dev mode Vite serves the renderer on port 5173
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // Production – load the built index.html
    win.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  return win;
}

/* ── IPC handlers ────────────────────────────────────────── */

/**
 * open-file – Show a native Open dialog, read the binary file,
 *             and return an array of doubles to the renderer.
 */
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select a binary file of doubles',
    filters: [{ name: 'Binary', extensions: ['bin'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const buf = fs.readFileSync(filePath);

  // Each double = 8 bytes
  const count = Math.floor(buf.length / 8);
  const doubles = [];
  for (let i = 0; i < count; i++) {
    doubles.push(buf.readDoubleLE(i * 8));
  }

  console.log(`[main] Loaded ${count} doubles from ${filePath}`);
  return { filePath, doubles };
});

/**
 * generate-demo – Write a small demo .bin of random doubles
 *                 so users can try the app immediately.
 */
ipcMain.handle('generate-demo', async (_event, { count }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save demo binary file',
    defaultPath: `demo_${count}.bin`,
    filters: [{ name: 'Binary', extensions: ['bin'] }],
  });
  if (canceled) return null;

  generateDemoFile(filePath, count);
  console.log(`[main] Generated demo file with ${count} doubles at ${filePath}`);

  // Read it back
  const buf = fs.readFileSync(filePath);
  const doubles = [];
  for (let i = 0; i < Math.floor(buf.length / 8); i++) {
    doubles.push(buf.readDoubleLE(i * 8));
  }
  return { filePath, doubles };
});

/**
 * run-sort – Execute one of the three algorithms and return
 *            the full step-by-step trace to the renderer.
 */
ipcMain.handle('run-sort', async (_event, { algorithm, doubles, pageSize, bufferPages }) => {
  console.log(`[main] run-sort  algo=${algorithm}  N=${doubles.length}  pageSize=${pageSize}  B+1=${bufferPages}`);
  
  let result;
  switch (algorithm) {
    case '2-way':
      result = twoWayExternalMergeSort(doubles, pageSize, bufferPages);
      break;
    case 'b-way':
      result = bWayExternalMergeSort(doubles, pageSize, bufferPages);
      break;
    case 'repacking':
      result = repackingExternalMergeSort(doubles, pageSize, bufferPages);
      break;
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }

  console.log(`[main] ${algorithm} finished – passes=${result.passes.length}, totalIO=${result.totalIO}`);
  return result;
});

/* ── App lifecycle ───────────────────────────────────────── */

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
