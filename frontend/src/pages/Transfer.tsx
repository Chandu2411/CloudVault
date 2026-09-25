import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive, Server, Search, Folder, CheckSquare, Square,
  FilePlus2, CheckCircle2, Loader2, Zap, X, CheckCircle,
  AlertCircle, PlayCircle, ArrowRight, ArrowDown,
} from 'lucide-react';
import { getSourceAccount, getDestinations, getSourceFiles, generatePlan, startTransfer, refreshStorage } from '../api';
import { GoogleAccount, DriveFile, TransferPlanResult } from '../types';
import { useLocation } from 'react-router-dom';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return '';
  return `${formatBytes(bps)}/s`;
}

function formatEta(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec < 60)  return `~${Math.round(sec)}s left`;
  if (sec < 3600) return `~${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s left`;
  return `~${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m left`;
}

/** Derive a short label + background color from file name/mimeType */
function getFileTypeInfo(fileName: string, mimeType?: string): { label: string; bg: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const m = mimeType ?? '';

  if (ext === 'pdf' || m.includes('pdf'))
    return { label: 'PDF', bg: '#ef4444' };
  if (['doc', 'docx'].includes(ext) || m.includes('word') || m.includes('document'))
    return { label: 'DOC', bg: '#2563eb' };
  if (['xls', 'xlsx'].includes(ext) || m.includes('spreadsheet'))
    return { label: 'XLS', bg: '#16a34a' };
  if (['ppt', 'pptx'].includes(ext) || m.includes('presentation'))
    return { label: 'PPT', bg: '#ea580c' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || m.startsWith('image/'))
    return { label: 'IMG', bg: '#db2777' };
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext) || m.startsWith('video/'))
    return { label: 'VID', bg: '#7c3aed' };
  if (['mp3', 'wav', 'flac'].includes(ext) || m.startsWith('audio/'))
    return { label: 'AUD', bg: '#e11d48' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || m.includes('zip'))
    return { label: 'ZIP', bg: '#ca8a04' };
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go'].includes(ext))
    return { label: 'CODE', bg: '#0891b2' };
  if (ext === 'json' || m.includes('json'))
    return { label: 'JSON', bg: '#0891b2' };
  if (m.includes('folder'))
    return { label: 'DIR', bg: '#2563eb' };
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', bg: '#64748b' };
}

// ─── File type icon square (flat, matches reference UI) ────────────────────

function FileTypeIcon({ fileName, mimeType, size = 40 }: { fileName: string; mimeType?: string; size?: number }) {
  const { label, bg } = getFileTypeInfo(fileName, mimeType);
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size <= 32 ? 8 : 10 }}
    >
      {label}
    </div>
  );
}

// ─── SSE snapshot types ──────────────────────────────────────────────────────

type ItemSnapshot = {
  itemId: string;
  fileName: string;
  fileSizeBytes: number;
  transferredBytes: number;
  progressPercent: number;
  status: string; // QUEUED | TRANSFERRING | VERIFYING | COMPLETED | FAILED
  mimeType?: string;
  destinationEmail?: string;
  errorMessage?: string;
};

type ProgressSnapshot = {
  jobId: string;
  status: string;
  overallProgress: number;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  transferredBytes: number;
  currentFileName: string;
  speedBytesPerSec: number;
  estimatedRemainingSeconds: number;
  items: ItemSnapshot[];
};

// ─── Per-file row (matches Claude preview exactly) ───────────────────────────

function FileRow({ item }: { item: ItemSnapshot }) {
  const isActive      = item.status === 'TRANSFERRING' || item.status === 'VERIFYING';
  const isCompleted   = item.status === 'COMPLETED';
  const isFailed      = item.status === 'FAILED';
  const isQueued      = item.status === 'QUEUED';

  // Byte label shown under the file name
  const byteLabel = isCompleted
    ? `${formatBytes(item.fileSizeBytes)} · Done ✓`
    : isFailed
    ? `Failed${item.errorMessage ? ` · ${item.errorMessage.slice(0, 40)}` : ''}`
    : isQueued
    ? `0% · 0 B of ${formatBytes(item.fileSizeBytes)}`
    : item.status === 'VERIFYING'
    ? `${formatBytes(item.fileSizeBytes)} · Verifying…`
    : `${item.progressPercent}% · ${formatBytes(item.transferredBytes)} of ${formatBytes(item.fileSizeBytes)}`;

  const barColor = isCompleted ? '#10b981'
    : isFailed   ? '#ef4444'
    : isActive    ? '#3b82f6'
    : '#94a3b8';

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* Flat colored file-type icon */}
        <div className="relative flex-shrink-0">
          <FileTypeIcon fileName={item.fileName} mimeType={item.mimeType} size={40} />
          {isCompleted && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle size={10} color="white" />
            </div>
          )}
          {isFailed && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <X size={10} color="white" />
            </div>
          )}
          {isActive && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <Loader2 size={8} color="white" className="animate-spin" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-slate-800 truncate">{item.fileName}</p>
            {/* Status badge */}
            <span className={`flex-shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
              isCompleted ? 'text-emerald-700 bg-emerald-100'
              : isFailed  ? 'text-red-700 bg-red-100'
              : isActive  ? 'text-blue-700 bg-blue-100'
              : 'text-slate-500 bg-slate-100'
            }`}>
              {isCompleted ? 'Done' : isFailed ? 'Failed' : isActive ? 'Transferring' : 'Queued'}
            </span>
          </div>
          <p className={`text-[10.5px] mt-0.5 ${
            isCompleted ? 'text-emerald-500' : isFailed ? 'text-red-400' : 'text-slate-400'
          }`}>
            {byteLabel}
          </p>
          {/* Thin progress bar */}
          <div className="mt-1.5 h-[3px] w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${isCompleted ? 100 : item.progressPercent}%`,
                background: barColor,
              }}
            >
              {isActive && (
                <div className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Source file icon (small, in the file table) ─────────────────────────────

function SmallFileIcon({ fileName, mimeType }: { fileName: string; mimeType: string }) {
  if (mimeType === 'application/vnd.google-apps.folder')
    return <Folder className="h-3.5 w-3.5 text-blue-400" />;
  const { label, bg } = getFileTypeInfo(fileName, mimeType);
  return (
    <div
      className="flex items-center justify-center rounded text-white font-bold flex-shrink-0"
      style={{ width: 16, height: 16, background: bg, fontSize: 7 }}
    >
      {label.slice(0, 3)}
    </div>
  );
}

// ─── Main Transfer page ───────────────────────────────────────────────────────

export function Transfer() {
  const location = useLocation();

  const [sourceAccount, setSourceAccount] = useState<GoogleAccount | null>(null);
  const [destAccounts,  setDestAccounts]  = useState<GoogleAccount[]>([]);
  const [allFiles,      setAllFiles]      = useState<DriveFile[]>([]);

  const initialSelected = location.state?.selectedFiles || [];
  const [selectedFiles,        setSelectedFiles]        = useState<DriveFile[]>(initialSelected);
  const [selectedDestAccounts, setSelectedDestAccounts] = useState<Set<string>>(new Set());

  const [search,           setSearch]           = useState('');
  const [loading,          setLoading]          = useState(true);
  const [plan,             setPlan]             = useState<TransferPlanResult | null>(null);
  const [generatingPlan,   setGeneratingPlan]   = useState(false);
  const [transferMode,     setTransferMode]     = useState<'COPY' | 'CUT'>('COPY');
  const [startingJob,      setStartingJob]      = useState(false);
  const [liveProgress,     setLiveProgress]     = useState<ProgressSnapshot | null>(null);
  const [activeJobId,      setActiveJobId]      = useState<string | null>(null);

  const sseRef = useRef<EventSource | null>(null);

  // ── Load accounts + files ─────────────────────────────────────────────────
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

  // ── SSE subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;

    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

    const token = localStorage.getItem('token');
    const url = `http://localhost:9090/api/jobs/${activeJobId}/progress${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('progress', (e: MessageEvent) => {
      try { setLiveProgress(JSON.parse(e.data)); } catch { /* ignore */ }
    });

    es.addEventListener('done', (e: MessageEvent) => {
      try { setLiveProgress(JSON.parse(e.data)); } catch { /* ignore */ }
      es.close(); sseRef.current = null;
      // Refresh storage stats
      Promise.all([
        getSourceAccount().then(src => {
          if (src) { refreshStorage(src.id).then(setSourceAccount); getSourceFiles(src.id).then(setAllFiles); }
        }),
        getDestinations().then(dests => Promise.all(dests.map(d => refreshStorage(d.id)))).then(setDestAccounts),
      ]).catch(console.error);
    });

    es.onerror = () => { /* browser auto-reconnects */ };

    return () => { es.close(); sseRef.current = null; };
  }, [activeJobId]);

  const filtered = allFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (file: DriveFile) => {
    setSelectedFiles(prev => prev.find(f => f.id === file.id)
      ? prev.filter(f => f.id !== file.id) : [...prev, file]);
    setPlan(null); setLiveProgress(null); setActiveJobId(null);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]); setPlan(null); setLiveProgress(null); setActiveJobId(null);
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
  };

  const toggleDestAccount = (id: string) => {
    setSelectedDestAccounts(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setPlan(null);
  };

  const handleGeneratePlan = () => {
    if (!selectedFiles.length) return;
    setGeneratingPlan(true);
    generatePlan(selectedFiles, Array.from(selectedDestAccounts))
      .then(setPlan).catch(console.error).finally(() => setGeneratingPlan(false));
  };

  const handleStartTransfer = async () => {
    if (!plan) return;
    setStartingJob(true);

    // Optimistic initial state — shown instantly before SSE connects
    setLiveProgress({
      jobId: '', status: 'IN_PROGRESS', overallProgress: 0,
      totalFiles: selectedFiles.length, completedFiles: 0, failedFiles: 0,
      totalBytes: selectedFiles.reduce((s, f) => s + (f.sizeBytes || 0), 0),
      transferredBytes: 0, currentFileName: '', speedBytesPerSec: 0,
      estimatedRemainingSeconds: -1,
      items: selectedFiles.map(f => {
        const entry = plan?.plan?.find(p => p.fileId === f.id);
        return {
          itemId: f.id, fileName: f.name, fileSizeBytes: f.sizeBytes ?? 0,
          transferredBytes: 0, progressPercent: 0, status: 'QUEUED',
          mimeType: f.mimeType, destinationEmail: entry?.destinationEmail,
        };
      }),
    });

    try {
      const job = await startTransfer(selectedFiles, Array.from(selectedDestAccounts), transferMode);
      setActiveJobId(job.id);
    } catch (e) {
      console.error(e); setLiveProgress(null);
    } finally {
      setStartingJob(false);
    }
  };

  const isDone   = liveProgress?.status === 'COMPLETED' || liveProgress?.status === 'FAILED';
  const isActive = !!liveProgress;

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  const overallPct = isDone && liveProgress?.status === 'COMPLETED'
    ? 100 : (liveProgress?.overallProgress ?? 0);

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)] overflow-hidden">

      {/* ── LEFT: Source Drive ─────────────────────────────────── */}
      <div className="flex-1 glass-card p-5 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Source Drive</h2>
          </div>
          {sourceAccount && (
            <span className="text-xs text-emerald-600 font-medium">{formatBytes(sourceAccount.storageAvailable)} free</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">{sourceAccount?.email || 'Not connected'}</p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)}
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
                const isSel    = selectedFiles.some(f => f.id === file.id);
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                return (
                  <tr key={file.id} onClick={() => !isFolder && toggleSelect(file)}
                    className={`border-b border-slate-50 transition-colors ${!isFolder ? 'cursor-pointer' : ''} ${isSel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      {!isFolder && (
                        <button onClick={e => { e.stopPropagation(); toggleSelect(file); }}>
                          {isSel ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" /> : <Square className="h-3.5 w-3.5 text-slate-300" />}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <SmallFileIcon fileName={file.name} mimeType={file.mimeType} />
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

      {/* ── MIDDLE: Progress Panel ──────────────────────────────── */}
      <div className="w-[280px] glass-card flex flex-col flex-shrink-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
          <FilePlus2 className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800 text-sm">Selected</h2>
          <span className="ml-auto text-xs font-medium text-slate-500">{selectedFiles.length} files</span>
        </div>

        {/* Transfer mode + generate plan (pre-transfer) */}
        {!isActive && selectedFiles.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transfer Mode</label>
              <select value={transferMode} onChange={e => setTransferMode(e.target.value as 'COPY' | 'CUT')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="COPY">Copy (Keep original)</option>
                <option value="CUT">Cut (Delete original)</option>
              </select>
            </div>
            <button onClick={handleGeneratePlan} disabled={generatingPlan || selectedDestAccounts.size === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50">
              {generatingPlan ? <><Loader2 size={13} className="animate-spin" /> Planning…</> : <><Zap size={13} /> Generate Plan</>}
            </button>
          </div>
        )}

        {/* Plan result */}
        {plan && !isActive && (
          <div className="mx-4 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-1.5 text-green-800 font-bold text-xs mb-2">
              <CheckCircle2 size={13} className="text-green-500" /> Plan Ready
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                { label: 'Fittable', value: plan.totalFittable, color: 'text-green-700' },
                { label: 'No Space', value: plan.totalUnfittable, color: 'text-red-500' },
                { label: 'Total Size', value: formatBytes(plan.totalSizeBytes), color: 'text-slate-700', wide: true },
              ].map(r => (
                <div key={r.label} className={`${r.wide ? 'col-span-2' : ''} rounded-lg bg-white border border-green-100 px-2 py-1.5 text-center`}>
                  <p className="text-[9px] text-slate-400 uppercase">{r.label}</p>
                  <p className={`text-xs font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
            <button onClick={handleStartTransfer} disabled={startingJob || plan.totalFittable === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-2.5 text-xs font-bold text-white shadow-md shadow-green-200 hover:from-emerald-600 hover:to-green-700 active:scale-95 transition-all disabled:opacity-50">
              {startingJob ? <><Loader2 size={13} className="animate-spin" /> Starting…</> : <><ArrowRight size={13} /> Start Transfer</>}
            </button>
          </div>
        )}

        {/* ── LIVE PROGRESS (SSE-driven, matches reference exactly) ── */}
        {isActive && liveProgress && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Overall progress card */}
            <div className="mx-3 mt-3 mb-2 rounded-xl border bg-white shadow-sm overflow-hidden"
              style={{ borderColor: isDone ? (liveProgress.status === 'COMPLETED' ? '#a7f3d0' : '#fca5a5') : '#bfdbfe' }}>

              {/* Top row: LIVE indicator + overall % */}
              <div className={`flex items-center justify-between px-3 pt-2.5 pb-1 ${isDone ? '' : ''}`}>
                <div className="flex items-center gap-1.5">
                  {!isDone ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Live Transfer</span>
                    </>
                  ) : liveProgress.status === 'COMPLETED' ? (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle size={11} /> Migration Complete
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle size={11} /> Transfer Failed
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-600">{overallPct}%</span>
              </div>

              {/* Big percentage */}
              <div className="px-3 pb-1">
                <span className="text-[40px] font-black text-slate-800 leading-none">{overallPct}</span>
                <span className="text-lg font-bold text-slate-400">%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-100 overflow-hidden mb-2">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${overallPct}%`,
                    background: isDone
                      ? liveProgress.status === 'COMPLETED' ? '#10b981' : '#ef4444'
                      : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  }}
                >
                  {!isDone && <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between px-3 text-[10.5px] text-slate-500">
                <span className="font-semibold">{liveProgress.completedFiles}/{liveProgress.totalFiles} files</span>
                <span>{formatBytes(liveProgress.transferredBytes)} / {formatBytes(liveProgress.totalBytes)}</span>
              </div>

              {/* Speed + ETA row */}
              {!isDone && liveProgress.speedBytesPerSec > 0 && (
                <div className="flex items-center justify-between px-3 pb-1 text-[10px]">
                  <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                    <ArrowDown size={9} /> {formatSpeed(liveProgress.speedBytesPerSec)}
                  </span>
                  <span className="text-slate-400">{formatEta(liveProgress.estimatedRemainingSeconds)}</span>
                </div>
              )}

              {/* Current file */}
              {!isDone && liveProgress.currentFileName && (
                <div className="px-3 pb-2.5 text-[10px] text-slate-400 truncate">
                  <span className="text-blue-500 font-bold">▶ </span>{liveProgress.currentFileName}
                </div>
              )}

              {/* Done action */}
              {isDone && (
                <div className="px-3 pb-3 pt-1">
                  {liveProgress.status === 'COMPLETED' && (
                    <p className="text-[10px] text-emerald-600 mb-2">
                      {liveProgress.totalFiles} files · {formatBytes(liveProgress.totalBytes)} transferred
                    </p>
                  )}
                  <button onClick={handleClearSelection}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                    Clear &amp; Start New Transfer
                  </button>
                </div>
              )}
            </div>

            {/* Per-file list — scrollable */}
            {liveProgress.items.length > 0 && (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 mx-1">
                {liveProgress.items.map(item => (
                  <FileRow key={item.itemId} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected files list (pre-transfer) */}
        {!isActive && (
          <div className="flex-1 overflow-y-auto px-4 pb-3">
            {selectedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <FilePlus2 className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-xs font-medium text-slate-400">No files selected</p>
                <p className="text-[11px] text-slate-300 mt-1">Select files from the left panel</p>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {selectedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2">
                    <FileTypeIcon fileName={f.name} mimeType={f.mimeType} size={28} />
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

      {/* ── RIGHT: Backup Accounts ──────────────────────────────── */}
      <div className="w-[260px] glass-card p-4 flex-shrink-0 flex flex-col overflow-hidden">
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
            const isSel = selectedDestAccounts.has(account.id);
            return (
              <div key={account.id} onClick={() => toggleDestAccount(account.id)}
                className={`rounded-xl border cursor-pointer transition-colors p-3 ${isSel ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <button onClick={e => { e.stopPropagation(); toggleDestAccount(account.id); }}>
                    {isSel ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-slate-300" />}
                  </button>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs uppercase">
                    {account?.displayName?.[0] || account?.email?.[0] || 'B'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{account.email}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isSel ? (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                          <span className="text-[9.5px] text-green-600 font-medium">Connected</span>
                        </>
                      ) : (
                        <>
                          <X className="h-2.5 w-2.5 text-slate-400" />
                          <span className="text-[9.5px] text-slate-500 font-medium">Not connected</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {[
                    { l: 'Total', v: formatBytes(account.storageTotal), cls: 'text-slate-700' },
                    { l: 'Used',  v: formatBytes(account.storageUsed),  cls: 'text-slate-700' },
                    { l: 'Free',  v: formatBytes(account.storageAvailable), cls: 'text-green-700' },
                  ].map(s => (
                    <div key={s.l} className="rounded bg-white p-1.5 text-center border border-slate-100">
                      <p className="text-[9px] text-slate-400">{s.l}</p>
                      <p className={`text-[9.5px] font-bold ${s.cls}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${usedPct}%` }} />
                </div>
              </div>
            );
          })}
          {destAccounts.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">No backup accounts connected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
