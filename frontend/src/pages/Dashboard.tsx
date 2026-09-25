import React, { useState, useEffect } from 'react';
import { HardDrive, Server, CheckCircle2, TrendingUp, AlertCircle, ArrowRight, Loader2, LogIn } from 'lucide-react';
import { getSourceAccount, getDestinations, getTransferHistory, authSourceUrl } from '../api';
import { GoogleAccount, TransferJob } from '../types';
import { useNavigate } from 'react-router-dom';

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

export function Dashboard() {
  const navigate = useNavigate();
  const [sourceAccount, setSourceAccount] = useState<GoogleAccount | null>(null);
  const [destAccounts, setDestAccounts] = useState<GoogleAccount[]>([]);
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSourceAccount(),
      getDestinations(),
      getTransferHistory()
    ]).then(([src, dests, history]) => {
      setSourceAccount(src);
      setDestAccounts(dests);
      setJobs(history);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
  const filesTransferred = completedJobs.reduce((sum, j) => sum + (j.totalFiles || 0), 0);
  const bytesTransferred = completedJobs.reduce((sum, j) => sum + (j.totalBytes || 0), 0);
  
  const destCapacity = destAccounts.reduce((sum, a) => sum + (a.storageTotal || 0), 0);
  const destAvailable = destAccounts.reduce((sum, a) => sum + (a.storageAvailable || 0), 0);

  const srcUsedPct = sourceAccount && sourceAccount.storageTotal 
    ? ((sourceAccount.storageUsed || 0) / sourceAccount.storageTotal) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome back{sourceAccount?.displayName ? `, ${sourceAccount.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here's your storage migration overview</p>
        </div>
        <button 
          onClick={() => navigate('/source')}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Start Migration
        </button>
      </div>

      {/* Alert Banner */}
      {sourceAccount && srcUsedPct > 90 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-white p-2 shadow-sm border border-red-100 text-red-500">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-800">Source Drive Almost Full</h3>
              <p className="text-sm text-red-600/80 mt-0.5">{srcUsedPct.toFixed(1)}% used — {formatBytes(sourceAccount.storageAvailable)} remaining. Migrate files to free up space.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/source')}
            className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700">
            Migrate Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Stat 1 */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Source Storage Used</h3>
            <div className="rounded-lg bg-red-50 p-2 text-red-500">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${srcUsedPct > 90 ? 'text-red-600' : 'text-slate-800'}`}>
              {sourceAccount ? `${srcUsedPct.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {sourceAccount ? `${formatBytes(sourceAccount.storageUsed)} / ${formatBytes(sourceAccount.storageTotal)}` : 'No source connected'}
          </p>
        </div>

        {/* Stat 2 */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Backup Accounts</h3>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-500">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-800">{destAccounts.length}</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">{formatBytes(destAvailable)} available</p>
        </div>

        {/* Stat 3 */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Files Transferred</h3>
            <div className="rounded-lg bg-green-50 p-2 text-green-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-800">{filesTransferred}</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">{completedJobs.length} completed jobs</p>
        </div>

        {/* Stat 4 */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Storage Freed</h3>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-slate-800">{formatBytes(bytesTransferred)}</span>
          </div>
          <p className="text-sm text-slate-400 mt-2">Moved to backup</p>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        {/* Source Drive */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-slate-500" />
                <h2 className="font-semibold text-slate-800">Source Drive</h2>
              </div>
              {sourceAccount ? (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-600">Connected</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Disconnected</span>
              )}
            </div>
            
            {sourceAccount ? (
              <>
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-12 w-12 rounded-full border border-slate-200 bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase">
                    {sourceAccount?.displayName?.[0] || sourceAccount?.email?.[0] || 'S'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{sourceAccount?.displayName || 'Google Account'}</p>
                    <p className="text-sm text-slate-500">{sourceAccount?.email || 'No email'}</p>
                  </div>
                </div>

                <div className="mb-2 flex justify-between text-xs font-medium">
                  <span className="text-slate-500">{formatBytes(sourceAccount.storageUsed)} / {formatBytes(sourceAccount.storageTotal)} used</span>
                  <span className={srcUsedPct > 90 ? 'text-red-600' : 'text-slate-600'}>{srcUsedPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${srcUsedPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${srcUsedPct}%` }} />
                </div>
                {srcUsedPct > 90 && <p className="mt-3 text-xs font-medium text-red-600">Critical — Storage Almost Full</p>}
              </>
            ) : (
              <div className="py-6 flex flex-col items-center text-center">
                <p className="text-sm text-slate-500 mb-4">Connect a Google Drive account to migrate files from.</p>
                <a href={authSourceUrl} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <LogIn className="h-4 w-4" /> Connect Source
                </a>
              </div>
            )}
          </div>
          
          {sourceAccount && (
            <button onClick={() => navigate('/source')} className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm">
              Browse Files <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Backup Accounts */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800">Backup Accounts</h2>
            </div>
            <button onClick={() => navigate('/backups')} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {destAccounts.map(account => {
              const usedPct = account.storageTotal ? ((account.storageUsed || 0) / account.storageTotal) * 100 : 0;
              return (
                <div key={account.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold shadow-sm uppercase">
                      {account?.displayName?.[0] || account?.email?.[0] || 'B'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-medium text-slate-700 truncate max-w-[140px]">{account?.email || 'No email'}</p>
                        <p className="text-xs font-medium text-emerald-600">{formatBytes(account.storageAvailable)} free</p>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${usedPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {destAccounts.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-4">No backup accounts connected.</p>
                <button onClick={() => navigate('/backups')} className="text-sm text-blue-600 font-semibold hover:underline">
                  Add Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
