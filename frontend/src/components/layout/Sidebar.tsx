import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
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
  { name: 'Source Drive', href: '/source', icon: HardDrive },
  { name: 'Backup Accounts', href: '/backups', icon: Server },
  { name: 'Transfer', href: '/transfer', icon: ArrowRightLeft },
  { name: 'Transfer History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex h-full w-64 flex-col bg-[#0B1120] text-slate-300 flex-shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800 flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-500/30">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">CloudVault</h1>
          <p className="text-[10px] text-slate-400 font-medium">Migrator Pro</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/dashboard' || item.href === '/'}
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

      {/* Version */}
      <div className="px-6 pb-4 pt-4 border-t border-slate-800 mt-auto">
        <p className="text-[10px] text-slate-600">v1.0.0 — College Prototype</p>
      </div>
    </div>
  );
}
