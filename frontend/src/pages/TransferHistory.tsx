import React, { useState, useEffect } from 'react';
import { Search, CheckCircle2, Loader2, XCircle, Filter } from 'lucide-react';
import { getTransferHistory } from '../api';
import { TransferJob } from '../types';

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  COMPLETED: { color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { color: 'text-blue-700', bg: 'bg-blue-100', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  FAILED: { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle className="h-3.5 w-3.5" /> },
  PLANNING: { color: 'text-slate-700', bg: 'bg-slate-100', icon: <Loader2 className="h-3.5 w-3.5" /> },
};

export function TransferHistory() {
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransferHistory()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
      
    // Optional: set up polling if we have IN_PROGRESS jobs
    const interval = setInterval(() => {
      getTransferHistory().then(setJobs).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const tabs: { label: string; count: number }[] = [
    { label: 'All', count: jobs.length },
    { label: 'COMPLETED', count: jobs.filter(j => j.status === 'COMPLETED').length },
    { label: 'IN_PROGRESS', count: jobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'PLANNING').length },
    { label: 'FAILED', count: jobs.filter(j => j.status === 'FAILED').length },
  ];

  const filtered = jobs.filter(j => {
    const statusMatch = activeTab === 'All' || 
                        j.status === activeTab || 
                        (activeTab === 'IN_PROGRESS' && j.status === 'PLANNING');
    const searchMatch = j.id.includes(search) || (j.sourceEmail && j.sourceEmail.includes(search));
    return statusMatch && searchMatch;
  });

  if (loading && jobs.length === 0) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Transfer History</h1>
        <p className="text-sm text-slate-500 mt-1">Complete audit trail of all file migrations</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-slate-100 p-2.5 text-slate-500">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{jobs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Jobs</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-green-100 p-2.5 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{jobs.filter(j => j.status === 'COMPLETED').length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Completed</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
            <Loader2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'PLANNING').length}</p>
            <p className="text-xs text-slate-500 mt-0.5">In Progress</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="rounded-lg bg-red-100 p-2.5 text-red-600">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{jobs.filter(j => j.status === 'FAILED').length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Failed</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Search by ID or account..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.label
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab.label ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3.5 font-semibold text-slate-600">Job / Files</th>
              <th className="text-left px-6 py-3.5 font-semibold text-slate-600">Source</th>
              <th className="text-left px-6 py-3.5 font-semibold text-slate-600">Size</th>
              <th className="text-left px-6 py-3.5 font-semibold text-slate-600">Date</th>
              <th className="text-left px-6 py-3.5 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(job => {
              const cfg = statusConfig[job.status] || statusConfig.PLANNING;
              return (
                <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cfg.color}>{cfg.icon}</div>
                      <div>
                        <p className="font-semibold text-slate-800">{job.totalFiles} file{job.totalFiles !== 1 ? 's' : ''}</p>
                        <p className="text-[10px] text-slate-400">Job #{job.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{job.sourceEmail}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-700">{formatBytes(job.totalBytes)}</p>
                    {job.failedFiles > 0 && <p className="text-xs text-red-500">{job.failedFiles} failed</p>}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(job.createdAt)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                      {job.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No transfer jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
