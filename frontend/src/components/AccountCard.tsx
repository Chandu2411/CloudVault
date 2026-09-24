import React from 'react';
import { GoogleAccount, DriveStorage } from '../types';
import { Trash2, Cloud, Database } from 'lucide-react';

interface Props {
  account: GoogleAccount;
  storage?: DriveStorage;
  onRemove?: (id: string) => void;
  isSource?: boolean;
}

export const AccountCard: React.FC<Props> = ({ account, storage, onRemove, isSource }) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercent = storage ? (storage.usage / storage.limit) * 100 : 0;

  return (
    <div className="glass-card p-6 flex flex-col relative overflow-hidden group">
      {/* Background glow effect */}
      <div className={`absolute -inset-0.5 opacity-20 group-hover:opacity-40 transition-opacity blur-xl ${isSource ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'} z-0`}></div>
      
      <div className="relative z-10 flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <img 
            src={account.pictureUrl || 'https://via.placeholder.com/48'} 
            alt={account.name} 
            className="w-12 h-12 rounded-full border-2 border-white/20 shadow-lg"
          />
          <div>
            <h3 className="font-bold text-lg">{account.name}</h3>
            <p className="text-sm text-slate-300">{account.email}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${isSource ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
              {isSource ? 'Source Drive' : 'Destination Drive'}
            </span>
          </div>
        </div>
        {onRemove && (
          <button 
            onClick={() => onRemove(account.id)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Disconnect Account"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {storage && (
        <div className="relative z-10 mt-auto pt-4 border-t border-white/10">
          <div className="flex justify-between text-xs text-slate-300 mb-2">
            <span className="flex items-center gap-1"><Database size={12}/> Used: {formatBytes(storage.usage)}</span>
            <span>Total: {formatBytes(storage.limit)}</span>
          </div>
          <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
