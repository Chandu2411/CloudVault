import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTransferProgress } from '../api';
import { TransferProgress as ITransferProgress } from '../types';
import { Home, Loader2, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';

export const TransferProgress: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ITransferProgress | null>(null);

  useEffect(() => {
    if (!id) return;
    
    // Initial fetch
    getTransferProgress(id).then(setProgress).catch(console.error);

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        const data = await getTransferProgress(id);
        setProgress(data);
        if (data.overallProgress === 100) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Failed to fetch progress", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);

  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        <p className="text-indigo-200">Connecting to transfer session...</p>
      </div>
    );
  }

  const isComplete = progress.overallProgress === 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED': return <PlayCircle className="text-slate-500" size={18} />;
      case 'TRANSFERRING': return <Loader2 className="text-blue-400 animate-spin" size={18} />;
      case 'VERIFYING': return <Loader2 className="text-indigo-400 animate-spin" size={18} />;
      case 'CLEANING_UP': return <Loader2 className="text-yellow-400 animate-spin" size={18} />;
      case 'COMPLETED': return <CheckCircle className="text-emerald-400" size={18} />;
      case 'FAILED': return <AlertCircle className="text-red-400" size={18} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-extrabold text-white">
          {isComplete ? 'Transfer Complete!' : 'Transfer in Progress'}
        </h2>
        <p className="text-indigo-200">Session ID: <span className="font-mono text-sm bg-black/30 px-2 py-1 rounded">{id}</span></p>
      </div>

      <div className="glass-card p-8 text-center space-y-6">
        <div className="flex items-end justify-center gap-2">
          <span className="text-6xl font-light text-white">{progress.overallProgress}</span>
          <span className="text-2xl text-indigo-300 pb-2">%</span>
        </div>
        <div className="w-full h-4 bg-black/50 rounded-full overflow-hidden shadow-inner border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-1000 ease-out"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-black/20">
          <h3 className="font-medium text-slate-200">Item Status</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-sm">
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">File ID</th>
              <th className="p-4 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {progress.items.map(item => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.transferStatus)}
                    <span className="text-sm font-medium">{item.transferStatus}</span>
                  </div>
                </td>
                <td className="p-4 font-mono text-xs text-slate-400">{item.id}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-full max-w-[100px] h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.transferStatus === 'COMPLETED' ? 'bg-emerald-500' : item.transferStatus === 'FAILED' ? 'bg-red-500' : 'bg-indigo-500'} transition-all duration-300`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 w-8">{item.progressPercent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isComplete && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-medium transition-colors"
          >
            <Home size={18} /> Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};
