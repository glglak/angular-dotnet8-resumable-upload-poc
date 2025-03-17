export interface UploadInitiateRequest {
  fileName: string;
  fileSize: number;
  chunkSize?: number;
  contentType?: string;
  checksum?: string;
}

export interface UploadInitiateResponse {
  uploadId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
}

export interface ChunkUploadRequest {
  uploadId: string;
  chunkNumber: number;
  checksum?: string;
}

export interface ChunkUploadResponse {
  uploadId: string;
  chunkNumber: number;
  success: boolean;
  isComplete: boolean;
  receivedChunks: number;
  totalChunks: number;
}

export interface UploadStatusResponse {
  uploadId: string;
  fileName: string;
  fileSize: number;
  state: UploadState;
  receivedChunks: number;
  totalChunks: number;
  missingChunks: number[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface UploadCompleteRequest {
  uploadId: string;
  finalChecksum?: string;
}

export interface UploadCompleteResponse {
  uploadId: string;
  fileName: string;
  fileSize: number;
  success: boolean;
  filePath?: string;
  errorMessage?: string;
  checksumVerified: boolean;
}

export enum UploadState {
  Initiated = 'Initiated',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Failed = 'Failed',
  Expired = 'Expired'
}

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  uploaded: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  speed?: number;
  remainingTime?: number;
}

export interface ChunkMetadata {
  index: number;
  start: number;
  end: number;
  size: number;
  uploaded: boolean;
  retries: number;
  checksum?: string;
}

export interface UploadSession {
  uploadId: string;
  file: File;
  chunks: ChunkMetadata[];
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
  lastUpdated: Date;
  checksum?: string;
}
