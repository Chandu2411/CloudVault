import React from 'react';
import { Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Intelligent Drive Migration System' },
  '/source': { title: 'Source Drive', subtitle: 'Intelligent Drive Migration System' },
  '/backups': { title: 'Backup Accounts', subtitle: 'Intelligent Drive Migration System' },
  '/transfer': { title: 'Transfer Files', subtitle: 'Intelligent Drive Migration System' },
  '/history': { title: 'Transfer History', subtitle: 'Intelligent Drive Migration System' },
  '/settings': { title: 'Settings', subtitle: 'Intelligent Drive Migration System' },
};

import { GoogleAccount } from '../../types';

export function Header({ sourceAccount }: { sourceAccount: GoogleAccount | null }) {
  const location = useLocation();
  const page = pageTitles[location.pathname] ?? { title: 'CloudVault', subtitle: 'Intelligent Drive Migration System' };

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
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6 cursor-pointer group">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold shadow-sm uppercase border border-slate-200">
              {sourceAccount.displayName ? sourceAccount.displayName[0] : sourceAccount.email[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{sourceAccount.displayName || 'Google Account'}</p>
              <p className="text-xs text-slate-500">{sourceAccount.email}</p>
            </div>
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
