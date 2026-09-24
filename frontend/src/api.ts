import axios from 'axios';
import { 
  GoogleAccount, 
  DriveFile, 
  TransferPlanResult, 
  TransferJob
} from './types';


// Assuming Vite proxy is set up or backend is on same host port 9090
const API = axios.create({
  baseURL: 'http://localhost:9090/api',
  withCredentials: true 
});

export const getSourceAccount = () => API.get<GoogleAccount>('/accounts/source').then(res => res.data);
export const getDestinations = () => API.get<GoogleAccount[]>('/accounts/destination').then(res => res.data);
export const removeDestination = (id: string) => API.delete(`/accounts/${id}`);
export const refreshStorage = (id: string) => API.post<GoogleAccount>(`/accounts/${id}/refresh-storage`).then(res => res.data);

export const getSourceFiles = (accountId: string) => {
  return API.get<DriveFile[]>(`/transfer/files/${accountId}`).then(res => res.data);
};

export const generatePlan = (files: DriveFile[]) => 
  API.post<TransferPlanResult>('/transfer/plan', files).then(res => res.data);

export const startTransfer = (files: DriveFile[], destinationAccountIds: string[]) => 
  API.post<TransferJob>('/transfer/start', { files, destinationAccountIds }).then(res => res.data);

export const getTransferHistory = () => API.get<TransferJob[]>('/jobs').then(res => res.data);
export const getTransferJob = (id: string) => API.get<TransferJob>(`/jobs/${id}`).then(res => res.data);
export const getTransferProgress = (id: string) => 
  API.get<TransferJob>(`/jobs/${id}`).then(res => {
    const job = res.data;
    const isCompleted = job.status === 'COMPLETED';
    
    let overallProgress = job.totalFiles > 0
      ? Math.round(((job.completedFiles || 0) / job.totalFiles) * 100)
      : 0;
      
    if (isCompleted) {
      overallProgress = 100;
    }
      
    return {
      overallProgress,
      status: job.status,
      completedFiles: isCompleted ? job.totalFiles : (job.completedFiles || 0),
      totalFiles: job.totalFiles,
      totalBytes: job.totalBytes,
      transferredBytes: isCompleted ? job.totalBytes : (job.transferredBytes || 0),
      items: (job.items || []).map(item => ({
        id: item.id,
        fileName: item.fileName,
        fileSizeBytes: item.fileSizeBytes,
        transferStatus: isCompleted ? 'COMPLETED' : item.status,
        progressPercent: isCompleted ? 100 : (item.progressPercent || 0),
        destinationEmail: item.destinationEmail,
        errorMessage: item.errorMessage,
      })),
    };
  });

export const authSourceUrl = 'http://localhost:9090/api/oauth/google/SOURCE';
export const authDestUrl = 'http://localhost:9090/api/oauth/google/DESTINATION';
