import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSourceFiles, getDestinations, generatePlan } from '../api';
import { DriveFile, GoogleAccount } from '../types';
import { Folder, FileText, ArrowRight, ArrowLeft, CloudRain } from 'lucide-react';

export const FileExplorer: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [destAccounts, setDestAccounts] = useState<GoogleAccount[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    loadFiles(currentFolderId);
    getDestinations().then(setDestAccounts);
  }, [currentFolderId]);

  const loadFiles = async (folderId?: string) => {
    setLoading(true);
    try {
      const data = await getSourceFiles(folderId);
      setFiles(data);
    } catch (error) {
      console.error("Failed to load files", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFileIds(newSet);
  };

  const handleNext = async () => {
    if (selectedFileIds.size === 0 || destAccounts.length === 0) return;
    setGeneratingPlan(true);
    try {
      const plan = await generatePlan(
        Array.from(selectedFileIds), 
        destAccounts.map(a => a.id)
      );
      // Navigate to planner with planId
      navigate(`/plan/${plan.planId}`, { state: { plan } });
    } catch (error) {
      console.error("Failed to generate plan", error);
      alert("Failed to generate transfer plan.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-indigo-300 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back
        </button>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CloudRain className="text-indigo-400" /> Source Drive Explorer
        </h2>
        <div className="text-sm bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full border border-indigo-500/30">
          {selectedFileIds.size} files selected
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
          <span className="font-medium text-slate-300">My Drive</span>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No files found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="p-4 font-medium w-12"></th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Size</th>
                  <th className="p-4 font-medium">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => {
                  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                  return (
                    <tr 
                      key={file.id} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${selectedFileIds.has(file.id) ? 'bg-indigo-500/10' : ''}`}
                      onClick={() => !isFolder && toggleSelect(file.id)}
                    >
                      <td className="p-4" onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}>
                        {!isFolder && (
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedFileIds.has(file.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500 bg-transparent'}`}>
                            {selectedFileIds.has(file.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div 
                          className="flex items-center gap-3"
                          onClick={(e) => {
                            if (isFolder) {
                              e.stopPropagation();
                              setCurrentFolderId(file.id);
                            }
                          }}
                        >
                          {isFolder ? <Folder className="text-blue-400" size={20} /> : <FileText className="text-slate-400" size={20} />}
                          <span className={isFolder ? 'font-medium text-blue-300 hover:underline' : ''}>{file.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{formatBytes(file.sizeBytes)}</td>
                      <td className="p-4 text-slate-400 text-sm">{new Date(file.modifiedTime).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={handleNext}
          disabled={selectedFileIds.size === 0 || generatingPlan}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg transition-all"
        >
          {generatingPlan ? 'Generating Plan...' : 'Generate Transfer Plan'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
