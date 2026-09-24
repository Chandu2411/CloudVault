import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  HardDrive, 
  Server, 
  ArrowRightLeft, 
  History, 
  Settings,
  Cloud
} from 'lucide-react';

import { GoogleAccount } from '../../types';

function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Source Drive', href: '/source', icon: HardDrive },
  { name: 'Backup Accounts', href: '/backups', icon: Server },
  { name: 'Transfer', href: '/transfer', icon: ArrowRightLeft },
  { name: 'Transfer History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ sourceAccount }: { sourceAccount: GoogleAccount | null }) {
  const srcUsedPct = sourceAccount && sourceAccount.storageTotal 
    ? ((sourceAccount.storageUsed || 0) / sourceAccount.storageTotal) * 100 
    : 0;

  return (
    <div className="flex h-full w-64 flex-col bg-[#0B1120] text-slate-300 flex-shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-500/30">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">CloudVault</h1>
          <p className="text-[10px] text-slate-400 font-medium">Migrator Pro</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-6">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Source Drive info widget at bottom */}
      {sourceAccount && (
        <div className="mx-3 mb-4 rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Source Drive</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs uppercase border border-slate-600 shadow-sm">
              {sourceAccount.displayName ? sourceAccount.displayName[0] : sourceAccount.email[0]}
            </div>
            <p className="text-xs font-medium text-slate-300 truncate">{sourceAccount.email}</p>
          </div>
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>{formatBytes(sourceAccount.storageUsed)} / {formatBytes(sourceAccount.storageTotal)} used</span>
            <span className={srcUsedPct > 90 ? "text-red-400 font-semibold" : "text-slate-400 font-semibold"}>{srcUsedPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
            <div className={`h-full rounded-full ${srcUsedPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${srcUsedPct}%` }} />
          </div>
          {srcUsedPct > 90 && (
            <p className="mt-2 text-[10px] font-semibold text-red-400">Critical — Storage Almost Full</p>
          )}
        </div>
      )}

      {/* Version */}
      <div className="px-6 pb-4">
        <p className="text-[10px] text-slate-600">v1.0.0 — College Prototype</p>
      </div>
    </div>
  );
}
