/**
 * PassesView.jsx – Display runs after each pass in collapsible cards
 * with animated transitions and visual value chips
 */

import React, { useState } from 'react';

export default function PassesView({ result, pageSize }) {
  const { passes } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Pass summary bar */}
      <div className="pv-summary-bar">
        <div className="pv-summary-item">
          <span className="pv-summary-value">{passes.length}</span>
          <span className="pv-summary-label">Passes</span>
        </div>
        <div className="pv-summary-item">
          <span className="pv-summary-value">{result.sorted.length}</span>
          <span className="pv-summary-label">Elements</span>
        </div>
        <div className="pv-summary-item">
          <span className="pv-summary-value">{result.reads + result.writes}</span>
          <span className="pv-summary-label">Total IO</span>
        </div>
      </div>

      {passes.map((pass, idx) => (
        <PassCard key={idx} pass={pass} pageSize={pageSize} passIndex={idx} totalPasses={passes.length} />
      ))}

      {/* Show sorted output */}
      <div className="pass-card pv-sorted-card">
        <div className="pass-header pv-sorted-header">
          <span>✅ Sorted Output ({result.sorted.length} elements)</span>
          <span className="pv-check-mark">✓</span>
        </div>
        <div className="pass-body">
          <div className="run-values">
            {result.sorted.slice(0, 200).map((v, i) => (
              <span className="sv-val sv-val--success" key={i} style={{ animationDelay: `${Math.min(i * 5, 500)}ms` }}>{v}</span>
            ))}
            {result.sorted.length > 200 && (
              <span className="sv-val sv-val--dim">…+{result.sorted.length - 200}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PassCard({ pass, pageSize, passIndex, totalPasses }) {
  const [open, setOpen] = useState(passIndex === 0 || passIndex === totalPasses - 1);

  // Determine pass icon
  const passIcon = passIndex === 0 ? '🏁' : passIndex === totalPasses - 1 ? '🎯' : '🔄';
  
  // Calculate total elements across runs
  const totalElems = pass.runs.reduce((sum, r) => sum + r.length, 0);

  return (
    <div className={`pass-card ${open ? 'pv-open' : ''}`} style={{ animationDelay: `${passIndex * 60}ms` }}>
      <div className="pass-header" onClick={() => setOpen(!open)}>
        <div className="pv-header-left">
          <span className="pv-pass-icon">{passIcon}</span>
          <span className="pv-pass-title">{pass.description}</span>
          <span className="pv-pass-meta">
            {pass.runs.length} runs · {totalElems} elems
          </span>
        </div>
        <span className={`pv-chevron ${open ? 'pv-chevron-up' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="pass-body">
          <div className="run-list">
            {pass.runs.map((run, ri) => (
              <div key={ri} className="pv-run-card" style={{ animationDelay: `${ri * 40}ms` }}>
                <div className="pv-run-header">
                  <span className="run-tag">
                    📄 Run {ri + 1}
                  </span>
                  <span className="pv-run-stats">
                    {run.length} elems · {Math.ceil(run.length / pageSize)} pages
                  </span>
                </div>
                <div className="run-values">
                  {run.slice(0, 120).map((v, vi) => (
                    <span className="sv-val sv-val--sm" key={vi}>{v}</span>
                  ))}
                  {run.length > 120 && (
                    <span className="sv-val sv-val--dim">…+{run.length - 120}</span>
                  )}
                </div>
                {/* Visual page boundaries */}
                <div className="pv-page-markers">
                  {Array.from({ length: Math.min(Math.ceil(run.length / pageSize), 20) }, (_, pi) => (
                    <span key={pi} className="pv-page-marker" title={`Page ${pi + 1}`}>
                      P{pi + 1}
                    </span>
                  ))}
                  {Math.ceil(run.length / pageSize) > 20 && (
                    <span className="pv-page-marker pv-page-marker--dim">+{Math.ceil(run.length / pageSize) - 20}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
