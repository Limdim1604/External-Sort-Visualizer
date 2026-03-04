/**
 * ============================================================
 *  App.jsx – Root component for External Sort Visualizer
 * ============================================================
 */

import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import VizPanel from './components/VizPanel';

export default function App() {
  /* ── State ─────────────────────────────────────────────── */
  const [fileInfo, setFileInfo]       = useState(null);   // { filePath, doubles[] }
  const [pageSize, setPageSize]       = useState(4);      // doubles per page
  const [bufferPages, setBufferPages] = useState(4);      // B+1
  const [results, setResults]         = useState({});      // { '2-way': ..., 'b-way': ..., 'repacking': ... }
  const [loading, setLoading]         = useState(false);
  const [activeAlgo, setActiveAlgo]   = useState(null);   // which result is shown
  const [viewTab, setViewTab]         = useState('passes'); // 'passes' | 'steps' | 'compare'

  /* ── Handlers ──────────────────────────────────────────── */

  const handleOpenFile = useCallback(async () => {
    const data = await window.electronAPI.openFile();
    if (data) {
      setFileInfo(data);
      setResults({});
      setActiveAlgo(null);
    }
  }, []);

  const handleGenerateDemo = useCallback(async (count) => {
    const data = await window.electronAPI.generateDemo(count);
    if (data) {
      setFileInfo(data);
      setResults({});
      setActiveAlgo(null);
    }
  }, []);

  const handleRunAlgorithm = useCallback(async (algo) => {
    if (!fileInfo) return;
    setLoading(true);
    setActiveAlgo(algo);
    setViewTab('passes');
    try {
      const result = await window.electronAPI.runSort(
        algo, fileInfo.doubles, pageSize, bufferPages
      );
      setResults(prev => ({ ...prev, [algo]: result }));
    } catch (err) {
      console.error('Sort failed:', err);
    }
    setLoading(false);
  }, [fileInfo, pageSize, bufferPages]);

  const handleRunAll = useCallback(async () => {
    if (!fileInfo) return;
    setLoading(true);
    setViewTab('compare');
    const algos = ['2-way', 'b-way', 'repacking'];
    const newResults = {};
    for (const algo of algos) {
      try {
        newResults[algo] = await window.electronAPI.runSort(
          algo, fileInfo.doubles, pageSize, bufferPages
        );
      } catch (err) {
        console.error(`${algo} failed:`, err);
      }
    }
    setResults(newResults);
    setActiveAlgo(null);
    setLoading(false);
  }, [fileInfo, pageSize, bufferPages]);

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="app">
      <header className="header">
        <h1>⬡ External Sort Visualizer</h1>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          IO-aware Page-based Model
        </span>
      </header>

      <div className="main-content">
        <Sidebar
          fileInfo={fileInfo}
          pageSize={pageSize}
          setPageSize={setPageSize}
          bufferPages={bufferPages}
          setBufferPages={setBufferPages}
          onOpenFile={handleOpenFile}
          onGenerateDemo={handleGenerateDemo}
          onRunAlgorithm={handleRunAlgorithm}
          onRunAll={handleRunAll}
          loading={loading}
          activeAlgo={activeAlgo}
          results={results}
        />

        <VizPanel
          results={results}
          activeAlgo={activeAlgo}
          setActiveAlgo={setActiveAlgo}
          loading={loading}
          viewTab={viewTab}
          setViewTab={setViewTab}
          fileInfo={fileInfo}
          pageSize={pageSize}
          bufferPages={bufferPages}
        />
      </div>
    </div>
  );
}
