import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive, Server, Search, Folder, FileArchive, FileSpreadsheet,
  FileText, CheckSquare, Square, FilePlus2, CheckCircle2, Loader2,
  Zap, X, CheckCircle, AlertCircle, PlayCircle, ArrowRight, Activity,
} from 'lucide-react';
import { getSourceAccount, getDestinations, getSourceFiles, generatePlan, startTransfer, getTransferProgress, refreshStorage } from '../api';
import { GoogleAccount, DriveFile, TransferPlanResult } from '../types';
import { useLocation } from 'react-router-dom';

// ─── helpers ────────────────────────────────────────────────────────────────

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/vnd.google-apps.folder')        return <Folder         className="h-4 w-4 text-blue-400" />;
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return <FileArchive  className="h-4 w-4 text-yellow-500" />;
  if (mimeType === 'application/vnd.google-apps.spreadsheet')   return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  if (mimeType === 'application/vnd.google-apps.presentation')  return <FileText        className="h-4 w-4 text-orange-400" />;
  return <FilePlus2 className="h-4 w-4 text-slate-400" />;
}

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

type ItemProgress = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  transferStatus: string;
  progressPercent: number;
  destinationEmail?: string;
  errorMessage?: string;
};

type LiveProgress = {
  overallProgress: number;
  status: string;
  completedFiles: number;
  totalFiles: number;
  totalBytes: number;
  transferredBytes: number;
  items: ItemProgress[];
};

// ─── status badge ────────────────────────────────────────────────────────────

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
  const [destAccounts, setDestAccounts] = useState<GoogleAccount[]>([]);
  const [allFiles, setAllFiles] = useState<DriveFile[]>([]);

  const initialSelected = location.state?.selectedFiles || [];
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>(initialSelected);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [plan, setPlan] = useState<TransferPlanResult | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const [startingJob, setStartingJob] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load source + dest
  useEffect(() => {
    Promise.all([getSourceAccount(), getDestinations()])
      .then(([src, dests]) => {
        setSourceAccount(src);
        setDestAccounts(dests);
        if (src) return getSourceFiles(src.id);
        return [];
      })
      .then(setAllFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // real-time polling
  useEffect(() => {
    if (!activeJobId) return;
    const poll = async () => {
      try {
        const data = await getTransferProgress(activeJobId);
        setLiveProgress(prev => {
          // Fake progress for transferring items to make UI dynamic
          const updatedItems = data.items.map(item => {
            if (item.transferStatus === 'COMPLETED') return { ...item, progressPercent: 100 };
            if (item.transferStatus === 'FAILED') return item;
            
            // If it's transferring and backend says 0, we increment it locally
            const prevItem = prev?.items.find(i => i.id === item.id);
            if (item.transferStatus === 'TRANSFERRING' || item.transferStatus === 'VERIFYING') {
              const currentFake = prevItem && prevItem.progressPercent > 0 && prevItem.progressPercent < 95 
                ? prevItem.progressPercent 
                : 0;
              // Add a random 2-15% jump every tick
              const newFake = Math.min(95, currentFake + Math.floor(Math.random() * 15) + 2);
              return { ...item, progressPercent: Math.max(item.progressPercent, newFake) };
            }
            return item;
          });
          return { ...data, items: updatedItems } as LiveProgress;
        });

        if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Refresh storage stats when job finishes
          if (data.status === 'COMPLETED') {
            Promise.all([
              getSourceAccount().then(src => src && refreshStorage(src.id).then(setSourceAccount)),
              getDestinations().then(dests => Promise.all(dests.map(d => refreshStorage(d.id)))).then(setDestAccounts)
            ]).catch(console.error);
          }
        }
      } catch (e) { console.error(e); }
    };
    poll();
    intervalRef.current = setInterval(poll, 1000); // Poll faster for smoother fake progress
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
  };

  const handleGeneratePlan = () => {
    if (selectedFiles.length === 0) return;
    setGeneratingPlan(true);
    generatePlan(selectedFiles).then(setPlan).catch(console.error).finally(() => setGeneratingPlan(false));
  };

  const handleStartTransfer = async () => {
    if (!plan) return;
    setStartingJob(true);
    try {
      const job = await startTransfer(selectedFiles, destAccounts.map(a => a.id));
      setActiveJobId(job.id);
      setLiveProgress({
        overallProgress: 0,
        status: 'IN_PROGRESS',
        completedFiles: 0,
        totalFiles: selectedFiles.length,
        totalBytes: selectedFiles.reduce((s, f) => s + (f.sizeBytes || 0), 0),
        transferredBytes: 0,
        items: selectedFiles.map(f => ({
          id: f.id,
          fileName: f.name,
          fileSizeBytes: f.sizeBytes,
          transferStatus: 'QUEUED',
          progressPercent: 0,
        })),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setStartingJob(false);
    }
  };

  const isTransferDone = liveProgress?.status === 'COMPLETED' || liveProgress?.status === 'FAILED';
  const isTransferActive = !!liveProgress;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">

      {/* ── LEFT: Source Drive ─────────────────────────────────────── */}
      <div className="flex-1 glass-card p-5 flex flex-col min-w-0">
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
                return (
                  <tr key={file.id} className={`border-b border-slate-50 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-2.5">
                      {file.mimeType !== 'application/vnd.google-apps.folder' && (
                        <button onClick={() => toggleSelect(file)}>
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
      <div className="w-72 glass-card p-5 flex flex-col flex-shrink-0 gap-3">

        {/* header */}
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800 text-sm">Selected</h2>
          <span className="ml-auto text-xs font-medium text-slate-500">{selectedFiles.length} files</span>
        </div>

        {/* ── GENERATE PLAN BUTTON — always at top ── */}
        {selectedFiles.length > 0 && !isTransferActive && (
          <button
            onClick={handleGeneratePlan}
            disabled={generatingPlan || destAccounts.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPlan
              ? <><Loader2 size={13} className="animate-spin" /> Planning…</>
              : <><Zap size={13} /> Generate Transfer Plan</>
            }
          </button>
        )}

        {/* ── PLAN RESULT BOX ── */}
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

        {/* ── LIVE TRANSFER PROGRESS ── */}
        {isTransferActive && liveProgress && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">

            {/* overall progress card */}
            <div className={`rounded-xl border p-4 ${isTransferDone
                ? liveProgress.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
              }`}>
              {/* live indicator */}
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

              {/* big percentage */}
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-black text-slate-800 leading-none">{liveProgress.overallProgress}</span>
                <span className="text-lg font-bold text-slate-400 pb-0.5">%</span>
              </div>

              {/* green progress bar */}
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    liveProgress.status === 'FAILED'
                      ? 'bg-gradient-to-r from-red-400 to-red-500'
                      : 'bg-gradient-to-r from-emerald-400 via-green-400 to-green-500'
                  }`}
                  style={{ width: `${liveProgress.overallProgress}%` }}
                >
                  {/* shimmer animation while active */}
                  {!isTransferDone && (
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  )}
                </div>
              </div>

              {/* stats row */}
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{liveProgress.completedFiles}/{liveProgress.totalFiles} files</span>
                <span>{formatBytes(liveProgress.transferredBytes)} / {formatBytes(liveProgress.totalBytes)}</span>
              </div>

              {/* done / failed banner */}
              {isTransferDone && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${liveProgress.status === 'COMPLETED' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {liveProgress.status === 'COMPLETED'
                      ? <><CheckCircle size={14} /> Transfer Complete!</>
                      : <><AlertCircle size={14} /> Transfer Failed</>
                    }
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="w-full mt-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Clear & Start New Transfer
                  </button>
                </div>
              )}
            </div>

            {/* per-file list */}
            {liveProgress.items.length > 0 && (
              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
                {liveProgress.items.map(item => (
                  <div key={item.id} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FilePlus2 size={11} className="text-slate-400 flex-shrink-0" />
                      <p className="text-[11px] font-semibold text-slate-700 truncate flex-1">{item.fileName}</p>
                      <StatusBadge status={item.transferStatus} />
                    </div>
                    {/* per-file green bar */}
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.transferStatus === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : item.transferStatus === 'FAILED'
                            ? 'bg-red-400'
                            : 'bg-gradient-to-r from-green-400 to-emerald-500'
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>{item.progressPercent}%</span>
                      {item.destinationEmail && <span className="truncate max-w-[120px]">→ {item.destinationEmail}</span>}
                    </div>
                  </div>
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
      <div className="w-72 glass-card p-5 flex-shrink-0 flex flex-col">
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
              <div key={account.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-sm uppercase">
                      {account.displayName ? account.displayName[0] : account.email[0]}
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
