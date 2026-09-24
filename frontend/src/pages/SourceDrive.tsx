import React, { useState, useEffect } from 'react';
import { HardDrive, Search, ChevronRight, Folder, FileArchive, FileSpreadsheet, FileText, CheckSquare, Square, SortAsc, SortDesc, FilePlus2, LogIn, Loader2 } from 'lucide-react';
import { getSourceAccount, getSourceFiles, authSourceUrl } from '../api';
import { GoogleAccount, DriveFile } from '../types';
import { useNavigate } from 'react-router-dom';

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="h-5 w-5 text-blue-400" />;
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return <FileArchive className="h-5 w-5 text-yellow-500" />;
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (mimeType === 'application/vnd.google-apps.presentation') return <FileText className="h-5 w-5 text-orange-400" />;
  return <FilePlus2 className="h-5 w-5 text-slate-400" />;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

export function SourceDrive() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<GoogleAccount | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSourceAccount()
      .then(acc => {
        setAccount(acc);
        if (acc) {
          getSourceFiles(acc.id).then(setFiles).catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HardDrive className="h-16 w-16 text-slate-300 mb-6" />
        <h2 className="text-2xl font-bold text-slate-800">Connect Source Drive</h2>
        <p className="text-slate-500 mt-2 mb-8 text-center max-w-md">
          To get started, connect the Google Drive account that contains the files you want to migrate.
        </p>
        <a 
          href={authSourceUrl}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <LogIn className="h-5 w-5" />
          Connect with Google
        </a>
      </div>
    );
  }

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const selectableFiles = filtered.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === selectableFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableFiles.map(f => f.id)));
    }
  };

  const selectedFiles = files.filter(f => selected.has(f.id));

  const usedPercentage = account.storageTotal ? ((account.storageUsed || 0) / account.storageTotal) * 100 : 0;

  const handlePlanMigration = () => {
    // Navigate to transfer page and pass selected files in state
    navigate('/transfer', { state: { selectedFiles } });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 border-green-400 shadow bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase">
            {account.displayName ? account.displayName[0] : account.email[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{account.displayName || 'Google Account'}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">Source</span>
            </div>
            <p className="text-sm text-slate-500">{account.email}</p>
          </div>
        </div>

        {account.storageTotal && (
          <div className="ml-auto flex items-center gap-8">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{formatBytes(account.storageTotal)}</p>
              <p className="text-xs text-slate-500 mt-0.5">total</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{formatBytes(account.storageUsed)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Used</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{formatBytes(account.storageAvailable)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Free</p>
            </div>
            <div className="min-w-[200px]">
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="text-slate-500">{formatBytes(account.storageUsed)} used</span>
                <span className="text-red-600">{usedPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${usedPercentage}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-slate-800">Google Drive Files</h2>
            </div>
            <span className="text-sm text-slate-400">{files.length} items</span>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Search files and folders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              onClick={toggleAll}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600"
            >
              <Square className="h-3.5 w-3.5" />
              Select All
            </button>
          </div>

          <div>
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm relative">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-8 px-4 py-3"></th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">
                      <div className="flex items-center gap-1">Name <SortAsc className="h-3 w-3" /></div>
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-600">
                      <div className="flex items-center gap-1">Size <SortDesc className="h-3 w-3 text-slate-300" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((file) => (
                    <tr
                      key={file.id}
                      className={`border-b border-slate-50 transition-colors ${selected.has(file.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3">
                        {file.mimeType !== 'application/vnd.google-apps.folder' && (
                          <button onClick={() => toggleSelect(file.id)}>
                            {selected.has(file.id)
                              ? <CheckSquare className="h-4 w-4 text-blue-600" />
                              : <Square className="h-4 w-4 text-slate-300" />
                            }
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <FileIcon mimeType={file.mimeType} />
                          <a href={file.webViewLink} target="_blank" rel="noreferrer" className="font-medium text-slate-700 hover:text-blue-600">{file.name}</a>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatBytes(file.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="w-72 glass-card p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Selected Files</h2>
            {selected.size > 0 && (
              <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">{selected.size}</span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-6">Files to migrate to backup accounts</p>

          {selectedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FilePlus2 className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-400">No files selected</p>
              <p className="text-xs text-slate-300 mt-1">Check files in the explorer to add them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                {selectedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                    <FileIcon mimeType={f.mimeType} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(f.sizeBytes)}</p>
                    </div>
                    <button onClick={() => toggleSelect(f.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <button 
                onClick={handlePlanMigration}
                className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                Plan Migration →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
