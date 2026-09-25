import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive, Server, Search, Folder, FileArchive, FileSpreadsheet,
  FileText, CheckSquare, Square, FilePlus2, CheckCircle2, Loader2,
  Zap, X, CheckCircle, AlertCircle, PlayCircle, ArrowRight, Activity,
  Film, Image, Music, FileCode, FileJson, Clock, Gauge,
} from 'lucide-react';
import { getSourceAccount, getDestinations, getSourceFiles, generatePlan, startTransfer, refreshStorage } from '../api';
import { GoogleAccount, DriveFile, TransferPlanResult } from '../types';
import { useLocation } from 'react-router-dom';

// ─── helpers ────────────────────────────────────────────────────────────────

function FileIcon({ mimeType, size = 4 }: { mimeType: string; size?: number }) {
  const cls = `h-${size} w-${size}`;
  if (mimeType === 'application/vnd.google-apps.folder')        return <Folder         className={`${cls} text-blue-400`} />;
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return <FileArchive  className={`${cls} text-yellow-500`} />;
  if (mimeType === 'application/vnd.google-apps.spreadsheet')   return <FileSpreadsheet className={`${cls} text-green-500`} />;
  if (mimeType === 'application/vnd.google-apps.presentation')  return <FileText        className={`${cls} text-orange-400`} />;
  if (mimeType?.startsWith('video/'))   return <Film   className={`${cls} text-purple-400`} />;
  if (mimeType?.startsWith('image/'))   return <Image  className={`${cls} text-pink-400`} />;
  if (mimeType?.startsWith('audio/'))   return <Music  className={`${cls} text-rose-400`} />;
  if (mimeType === 'application/json')  return <FileJson  className={`${cls} text-cyan-400`} />;
  if (mimeType?.includes('javascript') || mimeType?.includes('typescript')) return <FileCode className={`${cls} text-amber-400`} />;
  return <FilePlus2 className={`${cls} text-slate-400`} />;
}

// ─── circular progress ring (Google Photos style) ───────────────────────────

function CircularProgress({
  percent, status, mimeType,
}: { percent: number; status: string; mimeType?: string }) {
  const SIZE = 48;
  const STROKE = 4;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  const ringColor =
    status === 'COMPLETED'  ? '#10b981'
    : status === 'FAILED'   ? '#ef4444'
    : status === 'VERIFYING'? '#818cf8'
    : '#22c55e';

  const trackColor = status === 'FAILED' ? '#fecaca' : '#e2e8f0';

  const thumbBg =
    mimeType?.startsWith('video/')             ? '#7c3aed'
    : mimeType?.startsWith('image/')           ? '#db2777'
    : mimeType?.startsWith('audio/')           ? '#e11d48'
    : mimeType === 'application/vnd.google-apps.spreadsheet' ? '#16a34a'
    : mimeType === 'application/vnd.google-apps.presentation'? '#ea580c'
    : mimeType === 'application/vnd.google-apps.folder'      ? '#2563eb'
    : mimeType?.includes('zip')               ? '#ca8a04'
    : mimeType === 'application/json'         ? '#0891b2'
    : '#475569';

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE} height={SIZE}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
      >
        <circle cx={SIZE/2} cy={SIZE/2} r={r}
          fill="none" stroke={trackColor} strokeWidth={STROKE}
        />
        <circle cx={SIZE/2} cy={SIZE/2} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease-out, stroke 0.3s' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: STROKE + 4 }}
      >
        <div
          className="w-full h-full rounded-md flex items-center justify-center"
          style={{ background: thumbBg }}
        >
          {status === 'COMPLETED' ? (
            <CheckCircle size={14} color="white" />
          ) : status === 'FAILED' ? (
            <AlertCircle size={14} color="white" />
          ) : status === 'QUEUED' ? (
            <PlayCircle size={14} color="white" />
          ) : (
            <Loader2 size={14} color="white" className="animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── per-file progress card ──────────────────────────────────────────────────

type ItemSnapshot = {
  itemId: string;
  fileName: string;
  fileSizeBytes: number;
  transferredBytes: number;
  progressPercent: number;
  status: string;
  mimeType?: string;
  destinationEmail?: string;
  errorMessage?: string;
};

function FileProgressCard({ item }: { item: ItemSnapshot }) {
  const isActive =
    item.status !== 'QUEUED' &&
    item.status !== 'COMPLETED' &&
    item.status !== 'FAILED';

  const cardBorder =
    item.status === 'COMPLETED' ? 'border-emerald-100 bg-emerald-50/50'
    : item.status === 'FAILED'  ? 'border-red-100 bg-red-50/50'
    : isActive                  ? 'border-blue-100 bg-white shadow-sm'
    :                             'border-slate-100 bg-slate-50/80';

  // Build the byte label using REAL transferred bytes from the backend
  const byteLabel =
    item.status === 'QUEUED'    ? `${formatBytes(item.fileSizeBytes)} · Waiting`
    : item.status === 'COMPLETED'? `${formatBytes(item.fileSizeBytes)} · Done ✓`
    : item.status === 'FAILED'  ? `Failed${item.errorMessage ? ` · ${item.errorMessage}` : ''}`
    : item.status === 'VERIFYING' ? `${formatBytes(item.fileSizeBytes)} · Verifying…`
    : `${formatBytes(item.transferredBytes)} of ${formatBytes(item.fileSizeBytes)}`;

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-all duration-300 ${cardBorder}`}>
      <div className="flex items-center gap-3">
        <CircularProgress
          percent={item.progressPercent}
          status={item.status}
          mimeType={item.mimeType}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] font-semibold text-slate-800 truncate leading-snug"
            title={item.fileName}
          >
            {item.fileName}
          </p>
          <p className={`text-[10.5px] mt-0.5 font-medium ${
            item.status === 'FAILED'    ? 'text-red-400'
            : item.status === 'COMPLETED'? 'text-emerald-500'
            : 'text-slate-400'
          }`}>
            {isActive && item.status === 'TRANSFERRING' && (
              <span className="font-bold text-slate-600 mr-1">{item.progressPercent}%</span>
            )}
            {byteLabel}
          </p>
          {item.destinationEmail && (
            <p className="text-[9.5px] text-slate-300 mt-0.5 truncate">
              → {item.destinationEmail}
            </p>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Progress bar — driven by real progressPercent from backend */}
      <div className="mt-2.5 h-[3px] w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
            item.status === 'COMPLETED' ? 'bg-emerald-400'
            : item.status === 'FAILED'  ? 'bg-red-400'
            : item.status === 'VERIFYING' ? 'bg-indigo-400'
            : 'bg-gradient-to-r from-green-400 via-emerald-400 to-green-500'
          }`}
          style={{ width: `${item.progressPercent}%` }}
        >
          {isActive && (
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return '—';
  return `${formatBytes(bps)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0 || seconds === -1) return '—';
  if (seconds < 60)  return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── SSE progress snapshot type ──────────────────────────────────────────────

type ProgressSnapshot = {
  jobId: string;
  status: string;
  overallProgress: number;       // 0-100, from real bytes
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  transferredBytes: number;      // real bytes transferred so far
  currentFileName: string;
  speedBytesPerSec: number;
  estimatedRemainingSeconds: number;
  items: ItemSnapshot[];
};

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    QUEUED:       { icon: <PlayCircle  size={13} />, color: 'text-slate-400 bg-slate-100',  label: 'Queued' },
    TRANSFERRING: { icon: <Loader2    size={13} className="animate-spin" />, color: 'text-blue-600 bg-blue-50',    label: 'Transferring' },
    VERIFYING:    { icon: <Loader2    size={13} className="animate-spin" />, color: 'text-indigo-600 bg-indigo-50', label: 'Verifying' },
    CLEANING_UP:  { icon: <Loader2    size={13} className="animate-spin" />, color: 'text-yellow-600 bg-yellow-50',label: 'Cleaning Up' },
    COMPLETED:    { icon: <CheckCircle size={13} />, color: 'text-emerald-600 bg-emerald-50',label: 'Done' },
    FAILED:       { icon: <AlertCircle size={13} />, color: 'text-red-600 bg-red-50',        label: 'Failed' },
  };
  const s = map[status] ?? { icon: null, color: 'text-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function Transfer() {
  const location = useLocation();

  const [sourceAccount, setSourceAccount] = useState<GoogleAccount | null>(null);
  const [destAccounts, setDestAccounts]   = useState<GoogleAccount[]>([]);
  const [allFiles, setAllFiles]           = useState<DriveFile[]>([]);

  const initialSelected = location.state?.selectedFiles || [];
  const [selectedFiles, setSelectedFiles]             = useState<DriveFile[]>(initialSelected);
  const [selectedDestAccounts, setSelectedDestAccounts] = useState<Set<string>>(new Set());

  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [plan, setPlan]               = useState<TransferPlanResult | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [transferMode, setTransferMode] = useState<'COPY' | 'CUT'>('COPY');
  const [startingJob, setStartingJob] = useState(false);

  /** Live progress from SSE. null = no transfer running. */
  const [liveProgress, setLiveProgress] = useState<ProgressSnapshot | null>(null);
  const [activeJobId, setActiveJobId]   = useState<string | null>(null);

  /** SSE EventSource ref — so we can close it on unmount / new job. */
  const sseRef = useRef<EventSource | null>(null);

  // load source + dest
  useEffect(() => {
    Promise.all([getSourceAccount(), getDestinations()])
      .then(([src, dests]) => {
        setSourceAccount(src);
        setDestAccounts(dests);
        setSelectedDestAccounts(new Set(dests.map(d => d.id)));
        if (src) return getSourceFiles(src.id);
        return [];
      })
      .then(setAllFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── SSE subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;

    // Close any previous SSE connection
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const token = localStorage.getItem('token');
    // EventSource does NOT support custom headers — pass token as query param
    const url = `http://localhost:9090/api/jobs/${activeJobId}/progress${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const snap: ProgressSnapshot = JSON.parse(e.data);
        setLiveProgress(snap);
      } catch (err) {
        console.error('SSE parse error', err);
      }
    });

    es.addEventListener('done', (e: MessageEvent) => {
      try {
        const snap: ProgressSnapshot = JSON.parse(e.data);
        setLiveProgress(snap);
      } catch { /* ignore */ }
      es.close();
      sseRef.current = null;

      // Refresh storage stats and file list when job finishes
      Promise.all([
        getSourceAccount().then(src => {
          if (src) {
            refreshStorage(src.id).then(setSourceAccount);
            getSourceFiles(src.id).then(setAllFiles);
          }
        }),
        getDestinations().then(dests =>
          Promise.all(dests.map(d => refreshStorage(d.id)))).then(setDestAccounts),
      ]).catch(console.error);
    });

    es.onerror = (err) => {
      console.error('SSE error', err);
      // If connection drops but job isn't done, reconnect handled by browser automatically
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [activeJobId]);

  const filtered = allFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (file: DriveFile) => {
    setSelectedFiles(prev => {
      const exists = prev.find(f => f.id === file.id);
      if (exists) return prev.filter(f => f.id !== file.id);
      return [...prev, file];
    });
    setPlan(null);
    setLiveProgress(null);
    setActiveJobId(null);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setPlan(null);
    setLiveProgress(null);
    setActiveJobId(null);
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
  };

  const toggleDestAccount = (id: string) => {
    setSelectedDestAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPlan(null);
  };

  const handleGeneratePlan = () => {
    if (selectedFiles.length === 0) return;
    setGeneratingPlan(true);
    generatePlan(selectedFiles, Array.from(selectedDestAccounts))
      .then(setPlan).catch(console.error).finally(() => setGeneratingPlan(false));
  };

  const handleStartTransfer = async () => {
    if (!plan) return;
    setStartingJob(true);

    // Show an optimistic initial UI immediately (before SSE connects)
    const initialItems: ItemSnapshot[] = selectedFiles.map(f => {
      const entry = plan?.plan?.find(p => p.fileId === f.id);
      return {
        itemId: f.id,
        fileName: f.name,
        fileSizeBytes: f.sizeBytes ?? 0,
        transferredBytes: 0,
        progressPercent: 0,
        status: 'QUEUED',
        mimeType: f.mimeType,
        destinationEmail: entry?.destinationEmail,
      };
    });
    setLiveProgress({
      jobId: '',
      status: 'IN_PROGRESS',
      overallProgress: 0,
      totalFiles: selectedFiles.length,
      completedFiles: 0,
      failedFiles: 0,
      totalBytes: selectedFiles.reduce((s, f) => s + (f.sizeBytes || 0), 0),
      transferredBytes: 0,
      currentFileName: '',
      speedBytesPerSec: 0,
      estimatedRemainingSeconds: -1,
      items: initialItems,
    });

    try {
      const job = await startTransfer(selectedFiles, Array.from(selectedDestAccounts), transferMode);
      setActiveJobId(job.id); // triggers SSE effect
    } catch (e) {
      console.error(e);
      setLiveProgress(null);
    } finally {
      setStartingJob(false);
    }
  };

  const isTransferDone   = liveProgress?.status === 'COMPLETED' || liveProgress?.status === 'FAILED';
  const isTransferActive = !!liveProgress;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)] overflow-hidden">

      {/* ── LEFT: Source Drive ─────────────────────────────────────── */}
      <div className="flex-1 glass-card p-5 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Source Drive</h2>
          </div>
          {sourceAccount && (
            <span className="text-xs text-emerald-600 font-medium">
              {formatBytes(sourceAccount.storageAvailable)} free
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">{sourceAccount?.email || 'Not connected'}</p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">My Drive</p>
        <div className="border border-slate-100 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="w-7 px-3 py-2.5" />
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600">Name</th>
                <th className="text-left px-2 py-2.5 font-semibold text-slate-600">Size</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(file => {
                const isSelected = selectedFiles.some(f => f.id === file.id);
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                return (
                  <tr
                    key={file.id}
                    onClick={() => !isFolder && toggleSelect(file)}
                    className={`border-b border-slate-50 transition-colors ${!isFolder ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      {!isFolder && (
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(file); }}>
                          {isSelected
                            ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                            : <Square className="h-3.5 w-3.5 text-slate-300" />}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileIcon mimeType={file.mimeType} />
                        <p className="font-medium text-slate-700 truncate max-w-[200px]">{file.name}</p>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500">{formatBytes(file.sizeBytes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MIDDLE: Selected + Plan + Live Progress ────────────────── */}
      <div className="w-72 glass-card p-5 flex flex-col flex-shrink-0 gap-3 overflow-hidden">

        <div className="flex items-center gap-2">
          <FilePlus2 className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800 text-sm">Selected</h2>
          <span className="ml-auto text-xs font-medium text-slate-500">{selectedFiles.length} files</span>
        </div>

        {selectedFiles.length > 0 && !isTransferActive && (
          <div className="flex flex-col gap-1 mt-1 mb-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transfer Mode</label>
            <select
              value={transferMode}
              onChange={(e) => setTransferMode(e.target.value as 'COPY' | 'CUT')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
            >
              <option value="COPY">Copy & Paste (Keep original)</option>
              <option value="CUT">Cut & Paste (Delete original)</option>
            </select>
          </div>
        )}

        {selectedFiles.length > 0 && !isTransferActive && (
          <button
            onClick={handleGeneratePlan}
            disabled={generatingPlan || selectedDestAccounts.size === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPlan
              ? <><Loader2 size={13} className="animate-spin" /> Planning…</>
              : <><Zap size={13} /> Generate Transfer Plan</>
            }
          </button>
        )}

        {plan && !isTransferActive && (
          <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-green-800 font-bold text-xs">
              <CheckCircle2 size={13} className="text-green-500" /> Plan Ready
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { label: 'Fittable',   value: plan.totalFittable,   color: 'text-green-700'  },
                { label: 'Unfittable', value: plan.totalUnfittable, color: 'text-red-500'    },
                { label: 'Total Size', value: formatBytes(plan.totalSizeBytes), color: 'text-slate-700', wide: true },
              ].map(r => (
                <div key={r.label} className={`${r.wide ? 'col-span-2' : ''} rounded-lg bg-white border border-green-100 px-2 py-1.5 text-center`}>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">{r.label}</p>
                  <p className={`text-xs font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleStartTransfer}
              disabled={startingJob || plan.totalFittable === 0}
              className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-2.5 text-xs font-bold text-white shadow-md shadow-green-200 hover:from-emerald-600 hover:to-green-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {startingJob
                ? <><Loader2 size={13} className="animate-spin" /> Starting…</>
                : <><ArrowRight size={13} /> Start Safe Transfer</>
              }
            </button>
          </div>
        )}

        {/* ── LIVE TRANSFER PROGRESS (SSE-driven) ── */}
        {isTransferActive && liveProgress && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">

            {/* overall progress card */}
            <div className={`rounded-xl border p-4 ${isTransferDone
                ? liveProgress.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
              }`}>

              {/* LIVE indicator */}
              {!isTransferDone && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[10px] font-semibold text-green-700 uppercase tracking-widest">Live Transfer</span>
                  <Activity size={10} className="text-green-500 ml-auto" />
                </div>
              )}

              {/* Big percentage — real bytes */}
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-black text-slate-800 leading-none">
                  {isTransferDone && liveProgress.status === 'COMPLETED' ? 100 : liveProgress.overallProgress}
                </span>
                <span className="text-lg font-bold text-slate-400 pb-0.5">%</span>
              </div>

              {/* Progress bar — real percentage */}
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    liveProgress.status === 'FAILED'
                      ? 'bg-gradient-to-r from-red-400 to-red-500'
                      : 'bg-gradient-to-r from-emerald-400 via-green-400 to-green-500'
                  }`}
                  style={{
                    width: `${isTransferDone && liveProgress.status === 'COMPLETED'
                      ? 100 : liveProgress.overallProgress}%`
                  }}
                >
                  {!isTransferDone && (
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>{liveProgress.completedFiles}/{liveProgress.totalFiles} files</span>
                <span>{formatBytes(liveProgress.transferredBytes)} / {formatBytes(liveProgress.totalBytes)}</span>
              </div>

              {/* Speed + ETA row — only shown while transferring */}
              {!isTransferDone && (liveProgress.speedBytesPerSec > 0 || liveProgress.estimatedRemainingSeconds > 0) && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 border-t border-blue-100 pt-1.5">
                  <div className="flex items-center gap-1">
                    <Gauge size={10} className="text-blue-400" />
                    <span className="font-semibold text-blue-600">
                      {formatSpeed(liveProgress.speedBytesPerSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-slate-400" />
                    <span>{formatEta(liveProgress.estimatedRemainingSeconds)} left</span>
                  </div>
                </div>
              )}

              {/* Current file name */}
              {!isTransferDone && liveProgress.currentFileName && (
                <p className="mt-1.5 text-[10px] text-slate-400 truncate">
                  <span className="text-blue-500 font-medium">▶ </span>
                  {liveProgress.currentFileName}
                </p>
              )}

              {/* Done / failed banner */}
              {isTransferDone && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${liveProgress.status === 'COMPLETED' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {liveProgress.status === 'COMPLETED'
                      ? <><CheckCircle size={14} /> Migration Complete ✓</>
                      : <><AlertCircle size={14} /> Transfer Failed</>
                    }
                  </div>
                  {liveProgress.status === 'COMPLETED' && (
                    <p className="text-[10px] text-emerald-600">
                      {liveProgress.totalFiles} files · {formatBytes(liveProgress.totalBytes)} transferred
                    </p>
                  )}
                  <button
                    onClick={handleClearSelection}
                    className="w-full mt-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Clear & Start New Transfer
                  </button>
                </div>
              )}
            </div>

            {/* Per-file list — real per-file progress from SSE */}
            {liveProgress.items.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {liveProgress.items.map(item => (
                  <FileProgressCard key={item.itemId} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SELECTED FILE LIST (when no transfer running) ── */}
        {!isTransferActive && (
          <div className="flex-1 overflow-y-auto">
            {selectedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <FilePlus2 className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-xs font-medium text-slate-400">No files selected</p>
                <p className="text-[11px] text-slate-300 mt-1">Check files in the explorer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2">
                    <FileIcon mimeType={f.mimeType} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{f.name}</p>
                      <p className="text-[10px] text-slate-400">{formatBytes(f.sizeBytes)}</p>
                    </div>
                    <button onClick={() => toggleSelect(f)} className="text-red-300 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Backup Accounts ─────────────────────────────────── */}
      <div className="w-72 glass-card p-5 flex-shrink-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Backup Accounts</h2>
          </div>
          <span className="text-xs text-slate-500">{destAccounts.length} connected</span>
        </div>

        <div className="space-y-3 overflow-y-auto flex-1">
          {destAccounts.map(account => {
            const usedPct = account.storageTotal ? ((account.storageUsed || 0) / account.storageTotal) * 100 : 0;
            return (
              <div
                key={account.id}
                onClick={() => toggleDestAccount(account.id)}
                className={`rounded-xl border cursor-pointer transition-colors ${selectedDestAccounts.has(account.id) ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'} p-4`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); toggleDestAccount(account.id); }} className="mr-1 mt-0.5">
                      {selectedDestAccounts.has(account.id)
                        ? <CheckSquare className="h-4 w-4 text-blue-600" />
                        : <Square className="h-4 w-4 text-slate-300" />}
                    </button>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-sm uppercase">
                      {account?.displayName?.[0] || account?.email?.[0] || 'B'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">{account.email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span className="text-[10px] text-green-600 font-medium">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded bg-white p-2 text-center border border-slate-100">
                    <p className="text-[10px] text-slate-400">Total</p>
                    <p className="text-[10px] font-bold text-slate-700">{formatBytes(account.storageTotal)}</p>
                  </div>
                  <div className="rounded bg-white p-2 text-center border border-slate-100">
                    <p className="text-[10px] text-slate-400">Used</p>
                    <p className="text-[10px] font-bold text-slate-700">{formatBytes(account.storageUsed)}</p>
                  </div>
                  <div className="rounded bg-green-50 p-2 text-center border border-green-100">
                    <p className="text-[10px] text-green-600">Free</p>
                    <p className="text-[10px] font-bold text-green-700">{formatBytes(account.storageAvailable)}</p>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${usedPct}%` }} />
                </div>
              </div>
            );
          })}
          {destAccounts.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">No backup accounts connected. Go to Backup Accounts to add one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
