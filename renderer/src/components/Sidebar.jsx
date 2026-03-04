/**
 * Sidebar.jsx – Controls: file loading, parameters, algorithm selection
 */

import React from 'react';

const ALGOS = [
  { id: '2-way',     name: '2-Way Merge Sort',       desc: 'Merge 2 runs at a time, 2 input + 1 output buffer' },
  { id: 'b-way',     name: 'B-Way Merge Sort',       desc: 'Merge B runs at a time using a heap, initial runs = B+1 pages' },
  { id: 'repacking', name: 'Repacking (Replacement Selection)', desc: 'Replacement selection for ~2(B+1) page runs, then B-way merge' },
];

export default function Sidebar({
  fileInfo, pageSize, setPageSize, bufferPages, setBufferPages,
  onOpenFile, onGenerateDemo, onRunAlgorithm, onRunAll,
  loading, activeAlgo, results,
}) {
  return (
    <aside className="sidebar">
      {/* ── File section ───────────────────────────────────── */}
      <div className="control-group">
        <h2>Input File</h2>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={onOpenFile} disabled={loading}>
            Open .bin File
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onGenerateDemo(16)} disabled={loading}>
            Demo 16
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onGenerateDemo(32)} disabled={loading}>
            Demo 32
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onGenerateDemo(64)} disabled={loading}>
            Demo 64
          </button>
        </div>

        {fileInfo && (
          <div className="file-info">
            <strong>{fileInfo.doubles.length}</strong> doubles loaded
            <br />
            {fileInfo.filePath}
          </div>
        )}
      </div>

      {/* ── Parameters ─────────────────────────────────────── */}
      <div className="control-group">
        <h2>Page Model</h2>
        <div className="control-row">
          <label>Page size (doubles/page)</label>
          <input
            type="number" min={1} max={1024}
            value={pageSize}
            onChange={e => setPageSize(Math.max(1, +e.target.value))}
          />
        </div>
        <div className="control-row">
          <label>Buffer pages (B+1)</label>
          <input
            type="number" min={3} max={256}
            value={bufferPages}
            onChange={e => setBufferPages(Math.max(3, +e.target.value))}
          />
        </div>
        {fileInfo && (
          <div className="file-info" style={{ fontSize: 11 }}>
            N = {Math.ceil(fileInfo.doubles.length / pageSize)} pages &nbsp;|&nbsp;
            B = {bufferPages - 1} input buffers &nbsp;|&nbsp;
            Run₀ = {bufferPages} pages ({bufferPages * pageSize} doubles)
          </div>
        )}
      </div>

      {/* ── Data Preview ───────────────────────────────────── */}
      {fileInfo && (
        <div className="control-group">
          <h2>Data Preview</h2>
          <div className="data-preview">
            {fileInfo.doubles.slice(0, 60).map((v, i) => (
              <span className="val-chip" key={i}>{v}</span>
            ))}
            {fileInfo.doubles.length > 60 && (
              <span className="val-chip" style={{ color: 'var(--text-dim)' }}>…+{fileInfo.doubles.length - 60}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Algorithm selection ────────────────────────────── */}
      <div className="control-group">
        <h2>Algorithm</h2>
        <div className="algo-buttons">
          {ALGOS.map(a => (
            <button
              key={a.id}
              className={`algo-btn ${activeAlgo === a.id ? 'active' : ''}`}
              onClick={() => onRunAlgorithm(a.id)}
              disabled={!fileInfo || loading}
            >
              <div className="algo-name">{a.name}</div>
              <div className="algo-desc">{a.desc}</div>
            </button>
          ))}
        </div>

        <button
          className="btn btn-accent"
          style={{ marginTop: 6 }}
          onClick={onRunAll}
          disabled={!fileInfo || loading}
        >
          Run All & Compare
        </button>
      </div>
    </aside>
  );
}
