export interface GoogleAccount {
  id: string;
  email: string;
  displayName?: string;
  pictureUrl?: string;
  role: 'SOURCE' | 'DESTINATION';
  storageTotal?: number;
  storageUsed?: number;
  storageAvailable?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink?: string;
  parents?: string[];
}

export interface TransferPlanEntry {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  canFit: boolean;
  destinationAccountId?: string;
  destinationEmail?: string;
}

export interface TransferPlanResult {
  plan: TransferPlanEntry[];
  totalFittable: number;
  totalUnfittable: number;
  totalSizeBytes: number;
}

export interface TransferItemSummary {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  status: 'QUEUED' | 'TRANSFERRING' | 'VERIFYING' | 'CLEANING_UP' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
  errorMessage?: string;
  destinationEmail?: string;
}

export interface TransferJob {
  id: string;
  jobName: string;
  sourceEmail: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  transferredBytes: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  items?: TransferItemSummary[];
}

export interface TransferProgress {
  overallProgress: number;
  items: {
    id: string;
    transferStatus: string;
    progressPercent: number;
  }[];
}
