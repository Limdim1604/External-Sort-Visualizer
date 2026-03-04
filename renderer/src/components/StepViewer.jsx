/**
 * ============================================================
 *  StepViewer.jsx – Animated step-by-step visualization
 * ============================================================
 *
 *  Visual layout for 2-way merge steps:
 *  ┌──────────────┐   ┌──────────────┐
 *  │  Buffer A     │   │  Buffer B     │
 *  │ [3] [12] [45] │   │ [23] [67] [78]│
 *  │  ▲ ptr        │   │  ▲ ptr        │
 *  └──────┬───────┘   └──────┬───────┘
 *         │  compare ≤ / >   │
 *         └─────────┬────────┘
 *                   ▼
 *         ┌──────────────────┐
 *         │  Output Buffer    │
 *         │ [3] [12] [23]    │
 *         └──────────────────┘
 *         ┌──────────────────┐
 *         │  Written to Disk  │
 *         │ [3,5,9,12,…]     │
 *         └──────────────────┘
 *
 *  For B-way / repacking: heap tree + frozen zone
 * ============================================================
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

/* ── Auto-play hook ────────────────────────────────────── */
function useAutoPlay(idx, setIdx, maxIdx, speed) {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setIdx(i => {
          if (i >= maxIdx) { setPlaying(false); return i; }
          return i + 1;
        });
      }, speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, maxIdx, setIdx]);

  return [playing, setPlaying];
}

/* ── Main component ────────────────────────────────────── */
export default function StepViewer({ steps }) {
  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState(800);
  const [playing, setPlaying] = useAutoPlay(idx, setIdx, steps?.length - 1 || 0, speed);

  const prev  = useCallback(() => { setPlaying(false); setIdx(i => Math.max(0, i - 1)); }, []);
  const next  = useCallback(() => { setPlaying(false); setIdx(i => Math.min(steps.length - 1, i + 1)); }, [steps]);
  const first = useCallback(() => { setPlaying(false); setIdx(0); }, []);
  const last  = useCallback(() => { setPlaying(false); setIdx(steps.length - 1); }, [steps]);

  if (!steps || steps.length === 0) {
    return (
      <div className="step-viewer">
        <div className="sv-empty">
          <div className="sv-empty-icon">📭</div>
          No step-by-step data available. Try a smaller dataset.
        </div>
      </div>
    );
  }

  const step = steps[Math.min(idx, steps.length - 1)];

  /* Step type → icon mapping */
  const typeIcons = {
    load: '📥', compare: '⚖️', write: '💾', 'heap-init': '🏗️',
    'heap-pop': '⬆️', freeze: '🧊', 'run-complete': '✅', pass: '📋',
  };

  return (
    <div className="step-viewer">
      {/* ── Navigation bar ─────────────────────────────────── */}
      <div className="sv-nav">
        <div className="sv-nav-buttons">
          <button className="btn btn-outline btn-sm" onClick={first} disabled={idx === 0}>⏮</button>
          <button className="btn btn-outline btn-sm" onClick={prev} disabled={idx === 0}>◀</button>
          <button
            className={`btn btn-sm ${playing ? 'btn-danger' : 'btn-accent'}`}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={next} disabled={idx === steps.length - 1}>▶</button>
          <button className="btn btn-outline btn-sm" onClick={last} disabled={idx === steps.length - 1}>⏭</button>
        </div>

        <div className="sv-progress-info">
          <span className="sv-step-counter">{idx + 1} / {steps.length}</span>
          <input
            type="range" min={0} max={steps.length - 1} value={idx}
            onChange={e => { setPlaying(false); setIdx(+e.target.value); }}
            className="sv-slider"
          />
        </div>

        <div className="sv-speed">
          <label>Speed</label>
          <input
            type="range" min={100} max={2000} step={100}
            value={2100 - speed}
            onChange={e => setSpeed(2100 - +e.target.value)}
            className="sv-speed-slider"
          />
          <span className="sv-speed-label">{speed}ms</span>
        </div>
      </div>

      {/* ── Step type badge + description ──────────────────── */}
      <div className="sv-step-header" key={idx}>
        <span className={`sv-badge sv-badge--${step.type}`}>
          {typeIcons[step.type] || '📎'} {step.type.replace('-', ' ')}
        </span>
        <span className="sv-description">{step.description}</span>
      </div>

      {/* ── Visual content area ────────────────────────────── */}
      <div className="sv-content" key={`content-${idx}`}>
        {/* 2-way merge: show buffer A, buffer B, output */}
        {step.data?.bufA !== undefined && (
          <TwoWayVisual step={step} />
        )}

        {/* B-way / heap-based: show heap + input buffers */}
        {step.data?.heap && !step.data?.bufA && (
          <HeapVisual step={step} />
        )}

        {/* Pass overview (runs snapshot) */}
        {Array.isArray(step.data) && step.data.length > 0 && Array.isArray(step.data[0]) && (
          <PassRunsVisual runs={step.data} />
        )}

        {/* Run completion */}
        {step.data?.run && !step.data?.heap && (
          <RunCompleteVisual step={step} />
        )}
      </div>

      {/* ── Mini timeline ──────────────────────────────────── */}
      <div className="sv-timeline">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`sv-timeline-dot sv-timeline-dot--${s.type} ${i === idx ? 'active' : ''} ${i < idx ? 'past' : ''}`}
            onClick={() => { setPlaying(false); setIdx(i); }}
            title={`Step ${i + 1}: ${s.type}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  2-Way Merge Visual                                       */
/* ────────────────────────────────────────────────────────── */

function TwoWayVisual({ step }) {
  const d = step.data;
  const isCompare = step.type === 'compare';
  const isWrite   = step.type === 'write';
  const isLoad    = step.type === 'load';

  return (
    <div className="sv-two-way">
      {/* ── Input Buffers Row ──────────────────────────────── */}
      <div className="sv-buffers-row">
        <BufferPanel
          label={`Input Buffer A`}
          subLabel={`Page ${(d.pageIdxA || 0) + 1} / ${d.totalPagesA || '?'}`}
          values={d.bufA}
          pointer={d.ptrA}
          highlightIdx={isCompare ? d.highlightA : null}
          highlightColor={isCompare ? (d.pickedSide === 'A' ? 'picked' : 'compared') : null}
          className={`sv-buf-a ${isLoad && d.loadedA ? 'sv-anim-load' : ''}`}
          icon="🅰️"
        />

        {/* Arrow / compare indicator */}
        <div className="sv-compare-zone">
          {isCompare && (
            <div className="sv-compare-indicator sv-anim-pop">
              <div className="sv-cmp-vs">VS</div>
              <div className="sv-cmp-values">
                <span className={`sv-cmp-val ${d.pickedSide === 'A' ? 'winner' : 'loser'}`}>{d.aVal}</span>
                <span className="sv-cmp-op">{d.aVal <= d.bVal ? '≤' : '>'}</span>
                <span className={`sv-cmp-val ${d.pickedSide === 'B' ? 'winner' : 'loser'}`}>{d.bVal}</span>
              </div>
              <div className="sv-cmp-result">
                Pick <strong>{d.pickedSide}</strong> → <span className="sv-picked-value">{d.picked}</span>
              </div>
            </div>
          )}
          {isLoad && (
            <div className="sv-load-indicator sv-anim-pop">
              <div className="sv-load-icon">📥</div>
              <div>Loading page into buffer</div>
            </div>
          )}
          {isWrite && (
            <div className="sv-write-indicator sv-anim-pop">
              <div className="sv-write-icon">💾</div>
              <div>Flushing output to disk</div>
            </div>
          )}
          {!isCompare && !isLoad && !isWrite && (
            <div className="sv-arrow-down">⬇</div>
          )}
        </div>

        <BufferPanel
          label={`Input Buffer B`}
          subLabel={`Page ${(d.pageIdxB || 0) + 1} / ${d.totalPagesB || '?'}`}
          values={d.bufB}
          pointer={d.ptrB}
          highlightIdx={isCompare ? d.highlightB : null}
          highlightColor={isCompare ? (d.pickedSide === 'B' ? 'picked' : 'compared') : null}
          className={`sv-buf-b ${isLoad && d.loadedB ? 'sv-anim-load' : ''}`}
          icon="🅱️"
        />
      </div>

      {/* ── Output Buffer ──────────────────────────────────── */}
      <div className={`sv-output-section ${isWrite ? 'sv-anim-flush' : ''}`}>
        <div className="sv-section-label">
          <span className="sv-section-icon">📤</span> Output Buffer
          <span className="sv-section-sub">{d.outBuf?.length || 0} values</span>
        </div>
        <div className="sv-output-values">
          {(d.outBuf || []).map((v, i) => (
            <span
              key={i}
              className={`sv-val sv-val--output ${i === (d.outBuf?.length || 0) - 1 && isCompare ? 'sv-anim-slide-in' : ''}`}
            >
              {v}
            </span>
          ))}
          {(!d.outBuf || d.outBuf.length === 0) && (
            <span className="sv-val sv-val--empty">empty</span>
          )}
        </div>
      </div>

      {/* ── Written to disk ────────────────────────────────── */}
      {d.written && d.written.length > 0 && (
        <div className="sv-disk-section">
          <div className="sv-section-label">
            <span className="sv-section-icon">💿</span> Written to Disk
            <span className="sv-section-sub">{d.written.length} values</span>
          </div>
          <div className="sv-disk-values">
            {d.written.slice(-40).map((v, i) => (
              <span key={i} className="sv-val sv-val--disk">{v}</span>
            ))}
            {d.written.length > 40 && (
              <span className="sv-val sv-val--dim">+{d.written.length - 40} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Buffer Panel (A or B) ───────────────────────────────── */

function BufferPanel({ label, subLabel, values, pointer, highlightIdx, highlightColor, className, icon }) {
  return (
    <div className={`sv-buffer-panel ${className || ''}`}>
      <div className="sv-buffer-header">
        <span className="sv-buffer-icon">{icon}</span>
        <span className="sv-buffer-label">{label}</span>
        <span className="sv-buffer-sub">{subLabel}</span>
      </div>
      <div className="sv-buffer-cells">
        {(values || []).map((v, i) => {
          let cls = 'sv-val';
          if (i < pointer) cls += ' sv-val--used';
          if (i === pointer) cls += ' sv-val--pointer';
          if (i === highlightIdx) {
            cls += highlightColor === 'picked'
              ? ' sv-val--picked sv-anim-pulse'
              : ' sv-val--compared sv-anim-glow';
          }
          return (
            <div key={i} className="sv-cell-wrapper">
              <span className={cls}>{v}</span>
              {i === pointer && <div className="sv-pointer-arrow">▲</div>}
            </div>
          );
        })}
        {(!values || values.length === 0) && (
          <span className="sv-val sv-val--empty">empty</span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Heap-based Visual (B-way & Repacking)                    */
/* ────────────────────────────────────────────────────────── */

function HeapVisual({ step }) {
  const d = step.data;
  const heapData = d.heap || [];
  const isHeapPop = step.type === 'heap-pop';
  const isWrite   = step.type === 'write';
  const isFrozen  = step.type === 'freeze';

  return (
    <div className="sv-heap-layout">
      {/* ── Heap ───────────────────────────────────────────── */}
      <div className="sv-heap-section">
        <div className="sv-section-label">
          <span className="sv-section-icon">🏔️</span> Min-Heap
          <span className="sv-section-sub">{heapData.length} elements</span>
        </div>

        {/* Tree-like heap rendering */}
        <div className="sv-heap-tree">
          {heapData.length > 0 ? (
            <HeapTree nodes={heapData} poppedValue={d.poppedValue} />
          ) : (
            <span className="sv-val sv-val--empty">empty</span>
          )}
        </div>

        {/* Popped value callout */}
        {isHeapPop && d.poppedValue !== undefined && (
          <div className="sv-popped-callout sv-anim-pop">
            <span className="sv-popped-label">Popped min:</span>
            <span className="sv-val sv-val--picked sv-anim-pulse">{d.poppedValue}</span>
            {d.poppedRun !== undefined && (
              <span className="sv-popped-from">from run {d.poppedRun}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Input buffers (for B-way) ──────────────────────── */}
      {d.inputBuffers && (
        <div className="sv-input-buffers-section">
          <div className="sv-section-label">
            <span className="sv-section-icon">📚</span> Input Buffers
          </div>
          <div className="sv-input-buffers-grid">
            {d.inputBuffers.map((buf, i) => (
              <div key={i} className={`sv-mini-buffer ${d.loadedRun === i ? 'sv-anim-load' : ''}`}>
                <div className="sv-mini-buffer-label">Run {i} (pg {buf.pageIdx})</div>
                <div className="sv-mini-buffer-cells">
                  {buf.page.map((v, j) => (
                    <span
                      key={j}
                      className={`sv-val sv-val--sm ${j < buf.ptr ? 'sv-val--used' : ''} ${j === buf.ptr ? 'sv-val--pointer' : ''}`}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Frozen zone (repacking) ────────────────────────── */}
      {d.frozen && d.frozen.length > 0 && (
        <div className={`sv-frozen-section ${isFrozen ? 'sv-anim-freeze' : ''}`}>
          <div className="sv-section-label">
            <span className="sv-section-icon">🧊</span> Frozen Values
            <span className="sv-section-sub">{d.frozen.length} values</span>
          </div>
          <div className="sv-frozen-values">
            {d.frozen.map((v, i) => (
              <span
                key={i}
                className={`sv-val sv-val--frozen ${i === d.frozen.length - 1 && isFrozen ? 'sv-anim-slide-in' : ''}`}
              >
                {v}
              </span>
            ))}
          </div>
          {d.frozenValue !== undefined && isFrozen && (
            <div className="sv-freeze-explain sv-anim-pop">
              ❄️ <strong>{d.frozenValue}</strong> frozen because it &lt; last written ({d.lastWritten ?? '∞'})
            </div>
          )}
        </div>
      )}

      {/* ── Output Buffer ──────────────────────────────────── */}
      <div className={`sv-output-section ${isWrite ? 'sv-anim-flush' : ''}`}>
        <div className="sv-section-label">
          <span className="sv-section-icon">📤</span> Output Buffer
          <span className="sv-section-sub">{d.outBuf?.length || 0} values</span>
        </div>
        <div className="sv-output-values">
          {(d.outBuf || []).map((v, i) => (
            <span
              key={i}
              className={`sv-val sv-val--output ${i === (d.outBuf?.length || 0) - 1 && isHeapPop ? 'sv-anim-slide-in' : ''}`}
            >
              {v}
            </span>
          ))}
          {(!d.outBuf || d.outBuf.length === 0) && (
            <span className="sv-val sv-val--empty">empty</span>
          )}
        </div>
      </div>

      {/* ── Current run (repacking) ────────────────────────── */}
      {d.currentRun && d.currentRun.length > 0 && (
        <div className="sv-current-run-section">
          <div className="sv-section-label">
            <span className="sv-section-icon">📝</span> Current Run #{(d.completedRuns || 0) + 1}
            <span className="sv-section-sub">{d.currentRun.length} values</span>
          </div>
          <div className="sv-disk-values">
            {d.currentRun.slice(-30).map((v, i) => (
              <span key={i} className="sv-val sv-val--disk">{v}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Written (disk) ─────────────────────────────────── */}
      {d.written && d.written.length > 0 && (
        <div className="sv-disk-section">
          <div className="sv-section-label">
            <span className="sv-section-icon">💿</span> Sorted Output
            <span className="sv-section-sub">{d.written.length} values</span>
          </div>
          <div className="sv-disk-values">
            {d.written.slice(-30).map((v, i) => (
              <span key={i} className="sv-val sv-val--disk">{v}</span>
            ))}
            {d.written.length > 30 && (
              <span className="sv-val sv-val--dim">+{d.written.length - 30}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Heap tree visualization ─────────────────────────────── */

function HeapTree({ nodes, poppedValue }) {
  if (nodes.length === 0) return null;

  // Render heap as leveled rows
  const levels = [];
  let start = 0;
  let levelSize = 1;
  while (start < nodes.length) {
    levels.push(nodes.slice(start, start + levelSize));
    start += levelSize;
    levelSize *= 2;
  }

  return (
    <div className="sv-heap-levels">
      {levels.map((level, li) => (
        <div key={li} className="sv-heap-level">
          {level.map((node, ni) => (
            <span
              key={ni}
              className={`sv-heap-node ${li === 0 ? 'sv-heap-root' : ''} ${node.value === poppedValue ? 'sv-anim-pulse' : ''}`}
            >
              <span className="sv-heap-value">{node.value}</span>
              {node.runIdx !== undefined && (
                <span className="sv-heap-run">r{node.runIdx}</span>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Pass Runs Visual ────────────────────────────────────── */

function PassRunsVisual({ runs }) {
  return (
    <div className="sv-pass-runs">
      <div className="sv-section-label">
        <span className="sv-section-icon">📋</span> Runs after this pass
      </div>
      {runs.map((run, ri) => (
        <div key={ri} className="sv-pass-run sv-anim-slide-in" style={{ animationDelay: `${ri * 80}ms` }}>
          <div className="sv-pass-run-label">Run {ri + 1} ({run.length} elems)</div>
          <div className="sv-pass-run-values">
            {run.slice(0, 60).map((v, vi) => (
              <span key={vi} className="sv-val sv-val--run">{v}</span>
            ))}
            {run.length > 60 && <span className="sv-val sv-val--dim">…+{run.length - 60}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Run Complete Visual ─────────────────────────────────── */

function RunCompleteVisual({ step }) {
  const d = step.data;
  return (
    <div className="sv-run-complete sv-anim-pop">
      <div className="sv-section-label">
        <span className="sv-section-icon">✅</span> Run Completed
      </div>
      {d.run && (
        <div className="sv-completed-run-values">
          {d.run.slice(0, 80).map((v, i) => (
            <span key={i} className="sv-val sv-val--success">{v}</span>
          ))}
          {d.run.length > 80 && <span className="sv-val sv-val--dim">…+{d.run.length - 80}</span>}
        </div>
      )}
      {d.unfreezing && (
        <div className="sv-unfreeze-notice sv-anim-slide-in">
          🔓 Unfreezing {d.frozen?.length || 0} values back into the heap for a new run
        </div>
      )}
    </div>
  );
}
