/**
 * ============================================================
 *  External Sort Algorithms  –  Page-based IO-aware model
 * ============================================================
 *
 *  Terminology (from ExtSort slides):
 *    N    = total number of pages in the file
 *    B+1  = total buffer pages available (one for output, B for input)
 *    Page = fixed-size block of `pageSize` doubles
 *
 *  IO cost rule:
 *    Each pass reads ALL pages and writes ALL pages = 2N IOs.
 *
 *  Three algorithms:
 *    1. 2-Way External Merge Sort
 *    2. B-Way External Merge Sort  (k = B input buffers)
 *    3. Repacking (Replacement Selection) + B-Way Merge
 *
 *  Every function returns a SortResult:
 *  {
 *    algorithm:   string,
 *    sorted:      number[],
 *    passes:      PassInfo[],        // per-pass detail
 *    totalIO:     number,
 *    numPasses:   number,
 *    stepByStep:  StepDetail[],      // fine-grained for small files
 *  }
 *
 *  PassInfo = { passIndex, runs: number[][], description }
 *  StepDetail = { type, description, data }
 * ============================================================
 */

const fs = require('fs');

/* ────────────────────────────────────────────────────────── */
/*  Utility helpers                                          */
/* ────────────────────────────────────────────────────────── */

/** Split a flat array into pages (chunks) of `pageSize`. */
function paginate(arr, pageSize) {
  const pages = [];
  for (let i = 0; i < arr.length; i += pageSize) {
    pages.push(arr.slice(i, i + pageSize));
  }
  return pages;
}

/** Flatten array of arrays. */
function flatten(arr) {
  return arr.reduce((acc, v) => acc.concat(v), []);
}

/** Deep-clone simple value arrays for snapshots. */
function snap(runs) {
  return runs.map(r => [...r]);
}

/** MinHeap with custom comparator (used for B-way merge & repacking). */
class MinHeap {
  constructor(comparator = (a, b) => a.value - b.value) {
    this.data = [];
    this.cmp = comparator;
  }
  size()  { return this.data.length; }
  peek()  { return this.data[0]; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  snapshot() {
    return this.data.map(d => ({ ...d }));
  }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.cmp(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.cmp(this.data[l], this.data[smallest]) < 0) smallest = l;
      if (r < n && this.cmp(this.data[r], this.data[smallest]) < 0) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}

/* ────────────────────────────────────────────────────────── */
/*  1.  2-Way External Merge Sort                            */
/* ────────────────────────────────────────────────────────── */

/**
 * Pass 0 : Sort each page individually (1 page fits in memory).
 * Pass 1+: Merge 2 runs at a time using 2 input buffers + 1 output buffer.
 * 
 * Cost: ceil(log2(N)) + 1 passes  →  total IO = 2N * numPasses
 */
function twoWayExternalMergeSort(doubles, pageSize, bufferPages) {
  const steps  = [];  // fine-grained steps (demo mode)
  const passes = [];  // high-level pass summaries

  const N = Math.ceil(doubles.length / pageSize); // total pages

  /* ── Pass 0: create initial sorted runs (1 page each) ──── */
  let runs = paginate([...doubles], pageSize).map(page => {
    page.sort((a, b) => a - b);
    return page;
  });

  passes.push({
    passIndex: 0,
    description: `Pass 0 – Sort each page individually (${runs.length} runs of 1 page)`,
    runs: snap(runs),
  });
  steps.push({ type: 'pass', description: `Pass 0: Created ${runs.length} sorted runs (1 page each)`, data: snap(runs) });

  /* ── Pass 1+: 2-way merge ─────────────────────────────── */
  let passIndex = 1;
  while (runs.length > 1) {
    const newRuns = [];
    for (let i = 0; i < runs.length; i += 2) {
      if (i + 1 < runs.length) {
        const merged = mergeTwoRuns(runs[i], runs[i + 1], pageSize, steps, passIndex);
        newRuns.push(merged);
      } else {
        newRuns.push(runs[i]); // odd run passes through
      }
    }
    runs = newRuns;

    passes.push({
      passIndex,
      description: `Pass ${passIndex} – Merged into ${runs.length} run(s)`,
      runs: snap(runs),
    });
    steps.push({ type: 'pass', description: `Pass ${passIndex}: ${runs.length} run(s) after 2-way merge`, data: snap(runs) });
    passIndex++;
  }

  const numPasses = passes.length;           // pass 0 counts
  const totalIO   = 2 * N * numPasses;

  return {
    algorithm:  '2-way',
    sorted:     runs[0] || [],
    passes,
    totalIO,
    numPasses,
    stepByStep: steps,
  };
}

/**
 * Merge two runs page by page (2 input buffers, 1 output buffer).
 * Records step-by-step for small-file demo mode.
 *
 * Every step now includes a full snapshot of buffer state so the
 * UI can render visual input/output buffers with highlighted pointers.
 */
function mergeTwoRuns(runA, runB, pageSize, steps, passIndex) {
  const pagesA = paginate(runA, pageSize);
  const pagesB = paginate(runB, pageSize);

  let ai = 0, bi = 0;           // page index
  let ap = 0, bp = 0;           // pointer inside current page
  let curA = pagesA[ai] || [];
  let curB = pagesB[bi] || [];
  const output = [];             // all written so far
  let outBuf = [];               // current output page buffer

  /** Build a full snapshot of the current buffer state */
  function bufSnap(extras) {
    return {
      bufA: [...curA],  ptrA: ap,  pageIdxA: ai, totalPagesA: pagesA.length,
      bufB: [...curB],  ptrB: bp,  pageIdxB: bi, totalPagesB: pagesB.length,
      outBuf: [...outBuf],
      written: [...output],
      ...extras,
    };
  }

  steps.push({
    type: 'load',
    description: `Pass ${passIndex}: Load first pages of two runs into input buffers`,
    data: bufSnap({ loadedA: true, loadedB: true }),
  });

  while (ai < pagesA.length || bi < pagesB.length || ap < curA.length || bp < curB.length) {
    // Refill page A if exhausted
    if (ap >= curA.length && ai < pagesA.length - 1) {
      ai++; ap = 0; curA = pagesA[ai];
      steps.push({ type: 'load', description: `Buffer A exhausted → load page A[${ai}]`, data: bufSnap({ loadedA: true }) });
    }
    // Refill page B if exhausted
    if (bp >= curB.length && bi < pagesB.length - 1) {
      bi++; bp = 0; curB = pagesB[bi];
      steps.push({ type: 'load', description: `Buffer B exhausted → load page B[${bi}]`, data: bufSnap({ loadedB: true }) });
    }

    const aVal = ap < curA.length ? curA[ap] : Infinity;
    const bVal = bp < curB.length ? curB[bp] : Infinity;

    if (aVal === Infinity && bVal === Infinity) break;

    const pickedSide = aVal <= bVal ? 'A' : 'B';
    const picked = pickedSide === 'A' ? aVal : bVal;
    const comparison = aVal <= bVal ? `${aVal} ≤ ${bVal}` : `${aVal} > ${bVal}`;

    // Step: the compare – BEFORE we move the pointer
    steps.push({
      type: 'compare',
      description: `Compare: ${comparison} → pick from ${pickedSide}`,
      data: bufSnap({
        aVal, bVal, picked, pickedSide,
        highlightA: ap,  // index to highlight in bufA
        highlightB: bp,  // index to highlight in bufB
      }),
    });

    outBuf.push(picked);
    if (pickedSide === 'A') ap++; else bp++;

    // Flush output buffer when full (page-based IO)
    if (outBuf.length === pageSize) {
      steps.push({
        type: 'write',
        description: `Output buffer full → write page to disk (${outBuf.length} values)`,
        data: bufSnap({ flushing: true }),
      });
      output.push(...outBuf);
      outBuf = [];
    }
  }

  // Flush remaining output
  if (outBuf.length > 0) {
    steps.push({
      type: 'write',
      description: `Write final partial output page (${outBuf.length} values)`,
      data: bufSnap({ flushing: true }),
    });
    output.push(...outBuf);
  }

  return output;
}

/* ────────────────────────────────────────────────────────── */
/*  2.  B-Way External Merge Sort                            */
/* ────────────────────────────────────────────────────────── */

/**
 * Pass 0: Create initial sorted runs of (B+1) pages each
 *         (read B+1 pages into memory, sort, write back).
 * Pass 1+: B-way merge  (B input buffers + 1 output buffer)
 *          using a MinHeap.
 *
 * Cost: 1 + ceil(log_B(ceil(N/(B+1)))) passes  →  IO = 2N * numPasses
 */
function bWayExternalMergeSort(doubles, pageSize, bufferPages) {
  const steps  = [];
  const passes = [];
  const B = bufferPages - 1;   // input buffers (B)
  const N = Math.ceil(doubles.length / pageSize);

  /* ── Pass 0: create sorted runs of (B+1) pages ───────── */
  const runSizeElems = bufferPages * pageSize;  // (B+1) * pageSize doubles
  let runs = [];
  for (let i = 0; i < doubles.length; i += runSizeElems) {
    const chunk = doubles.slice(i, i + runSizeElems);
    chunk.sort((a, b) => a - b);
    runs.push(chunk);
  }

  passes.push({
    passIndex: 0,
    description: `Pass 0 – Created ${runs.length} sorted runs of up to ${bufferPages} pages each`,
    runs: snap(runs),
  });
  steps.push({ type: 'pass', description: `Pass 0: ${runs.length} initial sorted runs`, data: snap(runs) });

  /* ── Pass 1+: B-way merge ─────────────────────────────── */
  let passIndex = 1;
  while (runs.length > 1) {
    const newRuns = [];
    // Merge B runs at a time
    for (let i = 0; i < runs.length; i += B) {
      const group = runs.slice(i, i + B);
      if (group.length === 1) {
        newRuns.push(group[0]);
      } else {
        const merged = bWayMerge(group, pageSize, steps, passIndex);
        newRuns.push(merged);
      }
    }
    runs = newRuns;

    passes.push({
      passIndex,
      description: `Pass ${passIndex} – ${B}-way merge → ${runs.length} run(s)`,
      runs: snap(runs),
    });
    steps.push({ type: 'pass', description: `Pass ${passIndex}: ${runs.length} run(s) after ${B}-way merge`, data: snap(runs) });
    passIndex++;
  }

  const numPasses = passes.length;
  const totalIO   = 2 * N * numPasses;

  return {
    algorithm:  'b-way',
    sorted:     runs[0] || [],
    passes,
    totalIO,
    numPasses,
    stepByStep: steps,
  };
}

/**
 * Merge k runs using a MinHeap.
 * Each run is read page-by-page; output is flushed page-by-page.
 */
function bWayMerge(runsGroup, pageSize, steps, passIndex) {
  const k = runsGroup.length;
  // Paginate each run
  const pagesList = runsGroup.map(r => paginate(r, pageSize));
  const ptrs   = new Array(k).fill(0);   // element pointer inside current page
  const pgIdx  = new Array(k).fill(0);   // current page index per run
  const curPages = pagesList.map((pages, i) => pages[0] ? [...pages[0]] : []);

  const heap = new MinHeap((a, b) => a.value - b.value);

  // Load first element from each run's first page into the heap
  for (let r = 0; r < k; r++) {
    if (curPages[r].length > 0) {
      heap.push({ value: curPages[r][0], runIdx: r });
      ptrs[r] = 1;
    }
  }

  const output = [];
  let outBuf = [];

  /** Snapshot helper for b-way merge state */
  function bSnap(extras) {
    return {
      heap: heap.snapshot(),
      inputBuffers: curPages.map((p, i) => ({ run: i, page: [...p], ptr: ptrs[i], pageIdx: pgIdx[i] })),
      outBuf: [...outBuf],
      written: [...output],
      k,
      ...extras,
    };
  }

  steps.push({
    type: 'heap-init',
    description: `Pass ${passIndex}: Heap initialized with first element from ${k} runs`,
    data: bSnap({}),
  });

  while (heap.size() > 0) {
    const { value, runIdx } = heap.pop();
    outBuf.push(value);

    steps.push({
      type: 'heap-pop',
      description: `Pop min = ${value} from run ${runIdx}`,
      data: bSnap({ poppedValue: value, poppedRun: runIdx }),
    });

    // Refill from same run
    const r = runIdx;
    if (ptrs[r] < curPages[r].length) {
      heap.push({ value: curPages[r][ptrs[r]], runIdx: r });
      ptrs[r]++;
    } else {
      // Load next page for this run
      pgIdx[r]++;
      if (pgIdx[r] < pagesList[r].length) {
        curPages[r] = [...pagesList[r][pgIdx[r]]];
        ptrs[r] = 1;
        heap.push({ value: curPages[r][0], runIdx: r });
        steps.push({ type: 'load', description: `Load page ${pgIdx[r]} of run ${r}`, data: bSnap({ loadedRun: r }) });
      }
    }

    // Flush output page when full
    if (outBuf.length === pageSize) {
      steps.push({ type: 'write', description: `Output buffer full → flush page to disk`, data: bSnap({ flushing: true }) });
      output.push(...outBuf);
      outBuf = [];
    }
  }

  if (outBuf.length > 0) {
    steps.push({ type: 'write', description: `Write final partial output page`, data: bSnap({ flushing: true }) });
    output.push(...outBuf);
  }

  return output;
}

/* ────────────────────────────────────────────────────────── */
/*  3.  Repacking (Replacement Selection) + B-Way Merge      */
/* ────────────────────────────────────────────────────────── */

/**
 * Pass 0: Use replacement selection with a heap of size (B+1)*pageSize
 *         to create runs of approximately 2*(B+1) pages.
 * Pass 1+: B-way merge.
 *
 * Replacement selection:
 *   - Fill heap with first (B+1) pages.
 *   - Repeatedly extract min and write to current run.
 *   - Read next element; if it >= last written, push normally.
 *   - Otherwise "freeze" it (put aside) until we start a new run.
 *   - When heap is empty, unfreeze all frozen, start new run.
 */
function repackingExternalMergeSort(doubles, pageSize, bufferPages) {
  const steps  = [];
  const passes = [];
  const B = bufferPages - 1;
  const N = Math.ceil(doubles.length / pageSize);

  /* ── Pass 0: Replacement Selection ────────────────────── */
  const heapCapacity = bufferPages * pageSize;  // (B+1) pages worth of elements
  const pages = paginate([...doubles], pageSize);
  
  // We read page by page into the heap
  const runs = [];
  let currentRun = [];
  let frozen = [];
  let lastWritten = -Infinity;

  const heap = new MinHeap((a, b) => a.value - b.value);

  // Initially load up to (B+1) pages into the heap
  let pagePtr = 0;
  let loadedElements = 0;
  while (pagePtr < pages.length && loadedElements < heapCapacity) {
    const page = pages[pagePtr];
    for (const val of page) {
      if (loadedElements < heapCapacity) {
        heap.push({ value: val });
        loadedElements++;
      }
    }
    steps.push({ type: 'load', description: `Repacking: Load page ${pagePtr} into heap`, data: { page: [...page] } });
    pagePtr++;
  }

  let outBuf = [];

  /** Snapshot helper for repacking state */
  function rSnap(extras) {
    return {
      heap: heap.snapshot(),
      frozen: [...frozen],
      outBuf: [...outBuf],
      currentRun: [...currentRun],
      completedRuns: runs.length,
      lastWritten: lastWritten === -Infinity ? null : lastWritten,
      ...extras,
    };
  }

  steps.push({
    type: 'heap-init',
    description: `Repacking: Heap filled with ${heap.size()} elements`,
    data: rSnap({}),
  });

  // Process all remaining pages + drain heap
  while (heap.size() > 0 || frozen.length > 0) {
    if (heap.size() === 0 && frozen.length > 0) {
      // Finish current run, unfreeze
      if (currentRun.length > 0) {
        if (outBuf.length > 0) { currentRun.push(...outBuf); outBuf = []; }
        runs.push([...currentRun]);
        steps.push({
          type: 'run-complete',
          description: `Run ${runs.length} complete (${currentRun.length} elements). Unfreezing ${frozen.length} frozen values back into heap.`,
          data: rSnap({ run: [...currentRun], unfreezing: true }),
        });
        currentRun = [];
      }
      lastWritten = -Infinity;
      for (const val of frozen) {
        heap.push({ value: val });
      }
      frozen = [];
      continue;
    }

    if (heap.size() === 0) break;

    const { value } = heap.pop();

    steps.push({
      type: 'heap-pop',
      description: `Pop min = ${value} from heap (last written: ${lastWritten === -Infinity ? '−∞' : lastWritten})`,
      data: rSnap({ poppedValue: value }),
    });

    outBuf.push(value);
    lastWritten = value;

    // Flush output page
    if (outBuf.length === pageSize) {
      steps.push({ type: 'write', description: `Output buffer full → flush page to current run`, data: rSnap({ flushing: true }) });
      currentRun.push(...outBuf);
      outBuf = [];
    }

    // Read next element from input pages (page-by-page IO)
    if (pagePtr < pages.length) {
      const nextVal = pages[pagePtr][0];
      pages[pagePtr] = pages[pagePtr].slice(1);
      if (pages[pagePtr].length === 0) {
        steps.push({ type: 'load', description: `Input page ${pagePtr} exhausted → advance to next page`, data: rSnap({}) });
        pagePtr++;
      }

      if (nextVal >= lastWritten) {
        heap.push({ value: nextVal });
      } else {
        frozen.push(nextVal);
        steps.push({
          type: 'freeze',
          description: `Freeze ${nextVal} — it is less than last written (${lastWritten})`,
          data: rSnap({ frozenValue: nextVal }),
        });
      }
    }
  }

  // Flush last run
  if (outBuf.length > 0) { currentRun.push(...outBuf); outBuf = []; }
  if (currentRun.length > 0) {
    runs.push([...currentRun]);
    steps.push({
      type: 'run-complete',
      description: `Run ${runs.length} complete (${currentRun.length} elements).`,
      data: rSnap({ run: [...currentRun] }),
    });
  }

  passes.push({
    passIndex: 0,
    description: `Pass 0 – Replacement Selection: ${runs.length} runs created`,
    runs: snap(runs),
  });
  steps.push({ type: 'pass', description: `Pass 0: ${runs.length} runs from replacement selection`, data: snap(runs) });

  /* ── Pass 1+: B-way merge (same as bWayExternalMergeSort) */
  let mergeRuns = runs.map(r => [...r]);
  let passIndex = 1;
  while (mergeRuns.length > 1) {
    const newRuns = [];
    for (let i = 0; i < mergeRuns.length; i += B) {
      const group = mergeRuns.slice(i, i + B);
      if (group.length === 1) {
        newRuns.push(group[0]);
      } else {
        const merged = bWayMerge(group, pageSize, steps, passIndex);
        newRuns.push(merged);
      }
    }
    mergeRuns = newRuns;

    passes.push({
      passIndex,
      description: `Pass ${passIndex} – ${B}-way merge → ${mergeRuns.length} run(s)`,
      runs: snap(mergeRuns),
    });
    steps.push({ type: 'pass', description: `Pass ${passIndex}: ${mergeRuns.length} run(s)`, data: snap(mergeRuns) });
    passIndex++;
  }

  const numPasses = passes.length;
  const totalIO   = 2 * N * numPasses;

  return {
    algorithm: 'repacking',
    sorted:    mergeRuns[0] || [],
    passes,
    totalIO,
    numPasses,
    stepByStep: steps,
  };
}

/* ────────────────────────────────────────────────────────── */
/*  Demo file generator                                      */
/* ────────────────────────────────────────────────────────── */

function generateDemoFile(filePath, count) {
  const buf = Buffer.alloc(count * 8);
  for (let i = 0; i < count; i++) {
    // Random double between 0 and 1000, rounded to 2 decimal places
    const val = Math.round(Math.random() * 100000) / 100;
    buf.writeDoubleLE(val, i * 8);
  }
  fs.writeFileSync(filePath, buf);
  console.log(`[algo] Wrote ${count} doubles to ${filePath}`);
}

/* ────────────────────────────────────────────────────────── */
/*  Exports                                                  */
/* ────────────────────────────────────────────────────────── */

module.exports = {
  twoWayExternalMergeSort,
  bWayExternalMergeSort,
  repackingExternalMergeSort,
  generateDemoFile,
};
