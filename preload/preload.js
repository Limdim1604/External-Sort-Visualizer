/**
 * ============================================================
 *  Preload Script – Secure bridge between main ↔ renderer
 * ============================================================
 *  Exposes a minimal API via contextBridge so the React UI
 *  can trigger file I/O and algorithm runs without ever
 *  touching Node or fs directly.
 * ============================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Open a .bin file and return { filePath, doubles[] } | null */
  openFile: () => ipcRenderer.invoke('open-file'),

  /** Generate a demo .bin with `count` random doubles */
  generateDemo: (count) => ipcRenderer.invoke('generate-demo', { count }),

  /**
   * Run a sorting algorithm.
   * @param {'2-way'|'b-way'|'repacking'} algorithm
   * @param {number[]} doubles  – the data
   * @param {number}   pageSize – doubles per page
   * @param {number}   bufferPages – B+1
   * @returns {Promise<SortResult>}
   */
  runSort: (algorithm, doubles, pageSize, bufferPages) =>
    ipcRenderer.invoke('run-sort', { algorithm, doubles, pageSize, bufferPages }),
});
