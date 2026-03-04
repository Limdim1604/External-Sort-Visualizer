/**
 * VizPanel.jsx – Main visualization area
 *
 * Tabs:
 *  - Passes   : shows runs after each pass
 *  - Steps    : step-by-step viewer (heap, loads, compares, writes)
 *  - Compare  : IO cost comparison table
 */

import React from 'react';
import PassesView from './PassesView';
import StepViewer from './StepViewer';
import CompareView from './CompareView';

export default function VizPanel({
  results, activeAlgo, setActiveAlgo, loading,
  viewTab, setViewTab, fileInfo, pageSize, bufferPages,
}) {
  const currentResult = activeAlgo ? results[activeAlgo] : null;
  const hasAnyResult  = Object.keys(results).length > 0;

  /* ── Empty state ───────────────────────────────────────── */
  if (!hasAnyResult && !loading) {
    return (
      <div className="viz-panel">
        <div className="placeholder">
          <div className="icon">📊</div>
          <div>Load a file and run an algorithm to visualize sorting</div>
          <div style={{ fontSize: 12 }}>Use the Demo buttons for a quick start</div>
        </div>
      </div>
    );
  }

  /* ── Loading spinner ───────────────────────────────────── */
  if (loading) {
    return (
      <div className="viz-panel">
        <div className="placeholder">
          <div className="spinner" />
          <div>Running sort…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="viz-panel">
      {/* ── Summary stat cards ─────────────────────────────── */}
      {currentResult && (
        <div className="results-summary">
          <div className="stat-card">
            <div className="stat-value">{currentResult.algorithm}</div>
            <div className="stat-label">Algorithm</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{currentResult.numPasses}</div>
            <div className="stat-label">Passes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{currentResult.totalIO}</div>
            <div className="stat-label">Total IO</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{currentResult.sorted.length}</div>
            <div className="stat-label">Elements</div>
          </div>
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className="tabs">
        <button
          className={`tab ${viewTab === 'passes' ? 'active' : ''}`}
          onClick={() => setViewTab('passes')}
        >
          Passes & Runs
        </button>
        <button
          className={`tab ${viewTab === 'steps' ? 'active' : ''}`}
          onClick={() => setViewTab('steps')}
        >
          Step-by-Step
        </button>
        <button
          className={`tab ${viewTab === 'compare' ? 'active' : ''}`}
          onClick={() => setViewTab('compare')}
        >
          IO Cost Compare
        </button>
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      {viewTab === 'passes' && currentResult && (
        <PassesView result={currentResult} pageSize={pageSize} />
      )}

      {viewTab === 'steps' && currentResult && (
        <StepViewer steps={currentResult.stepByStep} />
      )}

      {viewTab === 'compare' && (
        <CompareView
          results={results}
          fileInfo={fileInfo}
          pageSize={pageSize}
          bufferPages={bufferPages}
        />
      )}

      {/* If no specific algo selected, prompt */}
      {!currentResult && viewTab !== 'compare' && (
        <div className="placeholder" style={{ flex: 1 }}>
          <div>Select an algorithm on the left, or view the Compare tab</div>
        </div>
      )}
    </div>
  );
}
