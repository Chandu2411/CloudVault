import React, { useState, useEffect } from 'react';
import { Server, Plus, RefreshCw, Trash2, Info, CheckCircle2, Loader2, LogIn } from 'lucide-react';
import { getDestinations, removeDestination, refreshStorage, authDestUrl } from '../api';
import { GoogleAccount } from '../types';

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

export function BackupAccounts() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = () => {
    setLoading(true);
    getDestinations()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleRemove = (id: string) => {
    removeDestination(id).then(fetchAccounts).catch(console.error);
  };

  const handleRefresh = (id: string) => {
    refreshStorage(id).then(fetchAccounts).catch(console.error);
  };

  const totalCapacity = accounts.reduce((s, a) => s + (a.storageTotal || 0), 0);
  const totalFree = accounts.reduce((s, a) => s + (a.storageAvailable || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Backup Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">Manage destination Google Drive accounts for file migration</p>
        </div>
        <a 
          href={authDestUrl}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Backup Account
        </a>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Backup Account Rules</h3>
            <ul className="space-y-1 text-sm text-blue-700 list-disc list-inside">
              <li>Each Google account authorizes independently via Google OAuth 2.0</li>
              <li>The same account cannot be added twice as a destination</li>
              <li>The source account <strong>cannot</strong> be added as a destination (prevents data loops)</li>
              <li>Each backup account's storage is refreshed before generating a transfer plan</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Connected Accounts</p>
          <p className="text-3xl font-bold text-slate-800">{accounts.length}</p>
          <p className="text-sm text-slate-400 mt-1">Backup destinations</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Total Backup Capacity</p>
          <p className="text-3xl font-bold text-slate-800">{formatBytes(totalCapacity)}</p>
          <p className="text-sm text-slate-400 mt-1">Combined storage</p>
        </div>
        <div className="glass-card p-6 border-l-4 border-l-green-400">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Available for Migration</p>
          <p className="text-3xl font-bold text-green-600">{formatBytes(totalFree)}</p>
          <p className="text-sm text-green-500 mt-1">Ready to receive files</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {accounts.map(account => {
            const usedPct = account.storageTotal ? Math.round(((account.storageUsed || 0) / account.storageTotal) * 100) : 0;
            return (
              <div key={account.id} className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow uppercase">
                      {account.displayName ? account.displayName[0] : account.email[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{account.email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleRefresh(account.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleRemove(account.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-sm font-semibold text-slate-500 mb-1">Total</p>
                    <p className="font-bold text-slate-800">{formatBytes(account.storageTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-sm font-semibold text-slate-500 mb-1">Used</p>
                    <p className="font-bold text-slate-800">{formatBytes(account.storageUsed)}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-sm font-semibold text-green-600 mb-1">Free</p>
                    <p className="font-bold text-green-700">{formatBytes(account.storageAvailable)}</p>
                  </div>
                </div>

                <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
                  <span>{formatBytes(account.storageUsed)} / {formatBytes(account.storageTotal)} used</span>
                  <span>{usedPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${usedPct}%` }} />
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 border-t border-slate-100 pt-4">
                  <Server className="h-4 w-4" />
                  <span>Available for migration</span>
                  <span className="ml-auto font-semibold text-slate-700">{formatBytes(account.storageAvailable)}</span>
                </div>
              </div>
            );
          })}

          <a 
            href={authDestUrl}
            className="rounded-xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all min-h-[220px]"
          >
            <div className="rounded-full border-2 border-dashed border-current p-3">
              <Plus className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Add Backup Account</p>
              <p className="text-sm mt-0.5">Connect another Google Drive</p>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
