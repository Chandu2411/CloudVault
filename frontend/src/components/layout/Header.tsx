import React, { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, HardDrive, Server, Settings } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Intelligent Drive Migration System' },
  '/source': { title: 'Source Drive', subtitle: 'Intelligent Drive Migration System' },
  '/backups': { title: 'Backup Accounts', subtitle: 'Intelligent Drive Migration System' },
  '/transfer': { title: 'Transfer Files', subtitle: 'Intelligent Drive Migration System' },
  '/history': { title: 'Transfer History', subtitle: 'Intelligent Drive Migration System' },
  '/settings': { title: 'Settings', subtitle: 'Intelligent Drive Migration System' },
};

import { GoogleAccount } from '../../types';
import { disconnectAccount } from '../../api';

export function Header({ sourceAccount, destAccounts = [] }: { sourceAccount: GoogleAccount | null, destAccounts?: GoogleAccount[] }) {
  const location = useLocation();
  const page = pageTitles[location.pathname] ?? { title: 'CloudVault', subtitle: 'Intelligent Drive Migration System' };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleSignOut = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (sourceAccount) {
      disconnectAccount(sourceAccount.id)
        .then(() => {
          window.location.href = '/';
        })
        .catch(console.error);
    } else {
      window.location.href = '/';
    }
  };

  const srcUsedPct = sourceAccount && sourceAccount.storageTotal 
    ? ((sourceAccount.storageUsed || 0) / sourceAccount.storageTotal) * 100 
    : 0;

  return (
    <header className="flex h-20 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{page.title}</h2>
        <p className="text-sm text-slate-500">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {sourceAccount ? (
          <div className="relative" ref={dropdownRef}>
            <div 
              className="flex items-center gap-3 border-l border-slate-200 pl-6 cursor-pointer group"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold shadow-sm uppercase border border-slate-200">
                {sourceAccount?.displayName?.[0] || sourceAccount?.email?.[0] || 'S'}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{sourceAccount?.displayName || 'Google Account'}</p>
                <p className="text-xs text-slate-500">{sourceAccount?.email || 'No email'}</p>
              </div>
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-200/50 z-50">
                
                {/* Source Drive Section */}
                <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Source Drive</span>
                  </div>
                  <div className="mb-1 flex justify-between text-[10px] text-slate-600">
                    <span>{formatBytes(sourceAccount.storageUsed)} / {formatBytes(sourceAccount.storageTotal)} used</span>
                    <span className={srcUsedPct > 90 ? "text-red-500 font-semibold" : "text-slate-600 font-semibold"}>{srcUsedPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${srcUsedPct > 90 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${srcUsedPct}%` }} />
                  </div>
                </div>

                {/* Backup Accounts Section */}
                {destAccounts && destAccounts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Server className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Backup Accounts ({destAccounts.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {destAccounts.map(account => {
                        const usedPct = account.storageTotal ? ((account.storageUsed || 0) / account.storageTotal) * 100 : 0;
                        return (
                          <div key={account.id} className="flex flex-col gap-1 bg-white border border-slate-100 p-2 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 font-bold text-[9px] uppercase border border-emerald-100 flex-shrink-0">
                                {account?.displayName?.[0] || account?.email?.[0] || 'B'}
                              </div>
                              <p className="text-[10px] font-medium text-slate-700 truncate">{account.email}</p>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 mt-0.5">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${usedPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
                  <Link 
                    to="/backups"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Settings size={14} />
                    Manage Backup Accounts
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6 cursor-pointer group">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold shadow-sm border border-slate-200">
              ?
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Not Connected</p>
              <p className="text-xs text-slate-500">Connect Source Drive</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
