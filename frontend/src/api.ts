import axios from 'axios';
import { 
  GoogleAccount, 
  DriveFile, 
  TransferPlanResult, 
  TransferJob
} from './types';


const API_BASE_URL = `http://${window.location.hostname}:9090/api`;

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true 
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const getSourceAccount = () => API.get<GoogleAccount>('/accounts/source').then(res => res.data);
export const getDestinations = () => API.get<GoogleAccount[]>('/accounts/destination').then(res => res.data);
export const removeDestination = (id: string) => API.delete(`/accounts/${id}`);
export const disconnectAccount = (id: string) => API.delete(`/accounts/${id}`);
export const refreshStorage = (id: string) => API.post<GoogleAccount>(`/accounts/${id}/refresh-storage`).then(res => res.data);

export const getSourceFiles = (accountId: string) => {
  return API.get<DriveFile[]>(`/transfer/files/${accountId}`).then(res => res.data);
};

export const generatePlan = (files: DriveFile[], destinationAccountIds: string[]) => 
  API.post<TransferPlanResult>('/transfer/plan', { files, destinationAccountIds }).then(res => res.data);

export const startTransfer = (files: DriveFile[], destinationAccountIds: string[], transferMode: 'COPY' | 'CUT' = 'COPY') => 
  API.post<TransferJob>('/transfer/start', { files, destinationAccountIds, transferMode }).then(res => res.data);

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

export const authSourceUrl = `http://${window.location.hostname}:9090/api/oauth/google/SOURCE`;

export const getAuthDestUrl = () => {
  const token = localStorage.getItem('token');
  return `http://${window.location.hostname}:9090/api/oauth/google/DESTINATION${token ? '?userId=' + token : ''}`;
};

export const registerUser = (data: any) => API.post('/auth/register', data).then(res => res.data);
export const loginUser = (data: any) => API.post('/auth/login', data).then(res => res.data);
