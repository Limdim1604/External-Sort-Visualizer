/**
 * CompareView.jsx – IO cost comparison between algorithms
 *
 * Shows a table comparing:
 *  - Number of passes
 *  - Total IO (2N * passes)
 * for all three algorithms.
 * Also shows the theoretical predictions.
 */

import React from 'react';

const ALGO_LABELS = {
  '2-way':     '2-Way Merge Sort',
  'b-way':     'B-Way Merge Sort',
  'repacking': 'Repacking + B-Way',
};

export default function CompareView({ results, fileInfo, pageSize, bufferPages }) {
  const algos = ['2-way', 'b-way', 'repacking'];
  const hasResults = algos.some(a => results[a]);

  const N = fileInfo ? Math.ceil(fileInfo.doubles.length / pageSize) : 0;
  const B = bufferPages - 1;

  /* Theoretical pass counts */
  const theory = {
    '2-way':     N > 0 ? 1 + Math.ceil(Math.log2(N)) : 0,
    'b-way':     N > 0 ? 1 + Math.ceil(logBase(B, Math.ceil(N / bufferPages))) : 0,
    'repacking': N > 0 ? 1 + Math.ceil(logBase(B, Math.ceil(N / (2 * bufferPages)))) : 0,
  };

  // Find best (lowest) IO
  const ioValues = algos.map(a => results[a]?.totalIO ?? Infinity);
  const bestIO = Math.min(...ioValues);

  if (!hasResults) {
    return (
      <div style={{ padding: 20, color: 'var(--text-dim)' }}>
        Run "Run All & Compare" to see IO cost comparison.
      </div>
    );
  }

  return (
    <div>
      {/* ── Parameters reminder ────────────────────────────── */}
      <div className="file-info" style={{ marginBottom: 16 }}>
        N = {N} pages &nbsp;|&nbsp; B+1 = {bufferPages} &nbsp;|&nbsp; B = {B}
        &nbsp;|&nbsp; Page size = {pageSize} doubles
        {fileInfo && <> &nbsp;|&nbsp; Total elements = {fileInfo.doubles.length}</>}
      </div>

      {/* ── Comparison table ───────────────────────────────── */}
      <table className="cost-table">
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Passes (actual)</th>
            <th>Passes (theory)</th>
            <th style={{ textAlign: 'right' }}>Total IO (2N × passes)</th>
            <th style={{ textAlign: 'right' }}>2N</th>
          </tr>
        </thead>
        <tbody>
          {algos.map(a => {
            const r = results[a];
            if (!r) return (
              <tr key={a}>
                <td>{ALGO_LABELS[a]}</td>
                <td colSpan={4} style={{ color: 'var(--text-dim)' }}>Not run yet</td>
              </tr>
            );
            const isBest = r.totalIO === bestIO;
            return (
              <tr key={a} className={isBest ? 'best' : ''}>
                <td>{ALGO_LABELS[a]}</td>
                <td className="num">{r.numPasses}</td>
                <td className="num">{theory[a]}</td>
                <td className="num">{r.totalIO}</td>
                <td className="num">{2 * N}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Visual bar chart ───────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12 }}>IO Cost (visual)</h3>
        {algos.map(a => {
          const r = results[a];
          if (!r) return null;
          const maxIO = Math.max(...algos.map(x => results[x]?.totalIO ?? 0));
          const pct = maxIO > 0 ? (r.totalIO / maxIO) * 100 : 0;
          const isBest = r.totalIO === bestIO;
          return (
            <div key={a} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, marginBottom: 3, color: isBest ? 'var(--success)' : 'var(--text)' }}>
                {ALGO_LABELS[a]} — {r.totalIO} IOs {isBest ? '✓ Best' : ''}
              </div>
              <div style={{
                height: 22,
                borderRadius: 4,
                background: 'var(--surface2)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: isBest ? 'var(--success)' : 'var(--primary)',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Formula reminder ───────────────────────────────── */}
      <div style={{ marginTop: 24, padding: 14, background: 'var(--surface)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--text)' }}>Formulas:</strong><br />
        • 2-Way: passes = 1 + ⌈log₂(N)⌉ → IO = 2N × passes<br />
        • B-Way: passes = 1 + ⌈log_B(⌈N/(B+1)⌉)⌉ → IO = 2N × passes<br />
        • Repacking: passes = 1 + ⌈log_B(⌈N/(2(B+1))⌉)⌉ → IO = 2N × passes<br />
        • Each pass costs 2N IOs (read all + write all)
      </div>
    </div>
  );
}

function logBase(base, x) {
  if (x <= 0) return 0;
  if (base <= 1) return 0;
  return Math.log(x) / Math.log(base);
}
