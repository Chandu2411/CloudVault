import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TransferPlanResult } from '../types';
import { startTransfer } from '../api';
import { Play, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

export const TransferPlanner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as TransferPlanResult;
  const [starting, setStarting] = useState(false);
  const [confirmSafe, setConfirmSafe] = useState(false);

  if (!plan) {
    return <div>No plan found. Please select files again.</div>;
  }

  const handleStart = async () => {
    if (!confirmSafe) {
      alert("Please check the safety confirmation box.");
      return;
    }
    setStarting(true);
    try {
      const job = await startTransfer(plan.planId, true);
      navigate(`/progress/${job.id}`);
    } catch (error) {
      console.error("Failed to start transfer", error);
      alert("Failed to start transfer.");
      setStarting(false);
    }
  };

  const totalAllocatedBytes = plan.items.reduce((acc, item) => acc + item.fileSizeBytes, 0);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-300 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Modify Selection
        </button>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Transfer Plan (Best Fit)
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 border-emerald-500/30 border">
          <div className="flex items-center gap-3 mb-2 text-emerald-400">
            <CheckCircle2 size={24} />
            <h3 className="text-xl font-bold">Allocated Files</h3>
          </div>
          <p className="text-3xl font-light mb-1">{plan.items.length}</p>
          <p className="text-sm text-emerald-200/60">Totaling {formatBytes(totalAllocatedBytes)}</p>
        </div>
        <div className={`glass-card p-6 border ${plan.unallocatedFiles.length > 0 ? 'border-red-500/50' : 'border-white/10'}`}>
          <div className="flex items-center gap-3 mb-2 text-red-400">
            <AlertTriangle size={24} />
            <h3 className="text-xl font-bold">Unallocated Files</h3>
          </div>
          <p className="text-3xl font-light mb-1">{plan.unallocatedFiles.length}</p>
          <p className="text-sm text-red-200/60">Insufficient storage in destination accounts</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-black/20">
          <h3 className="font-medium text-slate-200">Allocation Details</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-sm bg-black/10">
              <th className="p-4 font-medium">File Name</th>
              <th className="p-4 font-medium">Size</th>
              <th className="p-4 font-medium">Destination Account</th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 font-medium text-indigo-100">{item.fileName}</td>
                <td className="p-4 text-slate-300">{formatBytes(item.fileSizeBytes)}</td>
                <td className="p-4 text-emerald-300">{item.destinationEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card p-6 bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/30">
        <h3 className="font-bold text-lg mb-4 text-white">Safe Transfer Protocol</h3>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="mt-1 flex-shrink-0">
            <input 
              type="checkbox" 
              checked={confirmSafe}
              onChange={(e) => setConfirmSafe(e.target.checked)}
              className="w-5 h-5 rounded border-indigo-500 bg-black/50 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
          <div className="text-sm text-indigo-100/80 group-hover:text-indigo-50 transition-colors">
            <p className="font-medium text-white mb-1">I understand how files are handled:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Files will be copied to destination accounts first.</li>
              <li>Files are verified before source deletion (Name, Size, MD5).</li>
              <li>Verified source files will be moved to the <strong>Trash</strong> (they will not be permanently deleted immediately).</li>
            </ul>
          </div>
        </label>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleStart}
            disabled={starting || !confirmSafe || plan.items.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1"
          >
            {starting ? 'Starting...' : 'Start Transfer Job'} <Play fill="currentColor" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
