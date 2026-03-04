# External Sort Visualizer

Desktop application (Electron + React) to visualize the **External Merge Sort** algorithm following the **IO-aware, page-based model**.

## Features

- **2-Way External Merge Sort**
- **B-Way Merge Sort** (k = B input buffers, initial runs = B+1 pages)
- **Repacking / Replacement Selection** (~2(B+1) page runs, then B-way merge)
- Pass-by-pass run visualization
- Step-by-step demo mode (load page → compare → write)
- Heap state & frozen value display
- IO cost comparison table + bar chart
- Demo file generator for quick testing

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm

### Install dependencies

```bash
npm install
```

### Development mode

```bash
npm run dev
```

This starts the Vite dev server (port 5173) and launches Electron.  
Hot reload is enabled for the React renderer.

### Build Windows .exe

```bash
npm run dist
```

Output: `dist_electron/` folder with the installer `.exe`.

## How to use

1. Click **Open .bin File** to select a binary file of double-precision floats, or click **Demo 16/32/64** to generate a small test file.
2. Set **Page size** (doubles per page) and **Buffer pages** (B+1).
3. Select an algorithm or click **Run All & Compare**.
4. Browse the **Passes & Runs**, **Step-by-Step**, and **IO Cost Compare** tabs.

## Binary file format

The input `.bin` file must contain **double-precision floating-point numbers** (8 bytes each, little-endian). The app reads them using `Buffer.readDoubleLE`.

## Project Structure

```
/main            – Electron main process
/preload         – Secure preload bridge (contextBridge + IPC)
/renderer        – React UI (Vite)
  /src
    /components  – Sidebar, VizPanel, PassesView, StepViewer, CompareView
/algorithms      – externalSort.js (pure logic, no UI)
/assets          – App icon
```

## IO Cost Model

- Each pass reads **all N pages** and writes **all N pages** → **2N IOs per pass**
- Total IO = `2N × number_of_passes`

| Algorithm | Passes |
|-----------|--------|
| 2-Way | 1 + ⌈log₂(N)⌉ |
| B-Way | 1 + ⌈log_B(⌈N/(B+1)⌉)⌉ |
| Repacking | 1 + ⌈log_B(⌈N/(2(B+1))⌉)⌉ |
