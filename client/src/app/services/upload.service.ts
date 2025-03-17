import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, catchError, concatMap, filter, from, map, of, take, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import * as SparkMD5 from 'spark-md5';
import { get, set, del } from 'idb-keyval';
import {
  ChunkMetadata,
  ChunkUploadRequest,
  ChunkUploadResponse,
  UploadCompleteRequest,
  UploadCompleteResponse,
  UploadInitiateRequest,
  UploadInitiateResponse,
  UploadProgress,
  UploadSession,
  UploadState,
  UploadStatusResponse
} from '../models/upload.models';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private readonly API_URL = environment.apiUrl;
  private readonly CHUNK_SIZE = environment.uploadSettings.chunkSize;
  private readonly MAX_CONCURRENT_UPLOADS = environment.uploadSettings.maxConcurrentUploads;
  private readonly RETRY_ATTEMPTS = environment.uploadSettings.retryAttempts;
  private readonly RETRY_DELAY = environment.uploadSettings.retryDelay;
  private readonly SIMULATE_TIMEOUT = environment.uploadSettings.simulateTimeout;

  private activeUploads = new Map<string, UploadSession>();
  private uploadProgress$ = new BehaviorSubject<UploadProgress[]>([]);

  constructor(private http: HttpClient) { }

  getUploadProgress(): Observable<UploadProgress[]> {
    return this.uploadProgress$.asObservable();
  }

  async uploadFile(file: File): Promise<string> {
    try {
      // Check if we have an existing upload for this file
      const existingSession = await this.findExistingUpload(file);
      if (existingSession) {
        console.log('Resuming existing upload session', existingSession);
        return this.resumeUpload(existingSession);
      }

      // Calculate checksum for the file
      const checksum = await this.calculateFileChecksum(file);
      
      // Initialize upload
      const initRequest: UploadInitiateRequest = {
        fileName: file.name,
        fileSize: file.size,
        chunkSize: this.CHUNK_SIZE,
        contentType: file.type,
        checksum
      };

      const initResponse = await this.initializeUpload(initRequest).toPromise();
      if (!initResponse) {
        throw new Error('Failed to initialize upload');
      }
      
      // Create chunks
      const chunks = this.createChunks(file, initResponse.chunkSize, initResponse.totalChunks);
      
      // Create upload session
      const uploadSession: UploadSession = {
        uploadId: initResponse.uploadId,
        file: file,
        chunks,
        totalChunks: initResponse.totalChunks,
        chunkSize: initResponse.chunkSize,
        uploadedChunks: 0,
        progress: 0,
        status: 'pending',
        lastUpdated: new Date(),
        checksum
      };
      
      // Save session to IndexedDB
      await this.saveUploadSession(uploadSession);
      
      // Start upload
      this.activeUploads.set(uploadSession.uploadId, uploadSession);
      this.updateProgressState(uploadSession);
      
      return this.startUpload(uploadSession);
    } catch (error) {
      console.error('Error starting upload:', error);
      throw error;
    }
  }

  private async findExistingUpload(file: File): Promise<UploadSession | null> {
    try {
      // Get all upload sessions from IndexedDB
      const sessionIds: string[] = await get('uploadSessions') || [];
      
      for (const sessionId of sessionIds) {
        const session: UploadSession | undefined = await get(`upload_${sessionId}`);
        
        if (session && 
            session.file.name === file.name && 
            session.file.size === file.size && 
            session.file.type === file.type &&
            session.status !== 'completed') {
          
          // Verify upload still exists on server
          try {
            const status = await this.getUploadStatus(session.uploadId).toPromise();
            if (status && status.state !== UploadState.Expired) {
              // Reconnect the file object since it doesn't persist properly in IndexedDB
              session.file = file;
              return session;
            }
          } catch (error) {
            // Upload doesn't exist on server, remove from IndexedDB
            await this.removeUploadSession(session.uploadId);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding existing upload:', error);
      return null;
    }
  }

  private async resumeUpload(session: UploadSession): Promise<string> {
    try {
      // Get current status from server
      const status = await this.getUploadStatus(session.uploadId).toPromise();
      if (!status) {
        throw new Error('Failed to get upload status');
      }
      
      // Update chunks based on server status
      if (status.missingChunks.length > 0) {
        session.chunks.forEach(chunk => {
          chunk.uploaded = !status.missingChunks.includes(chunk.index);
        });
        
        session.uploadedChunks = status.receivedChunks;
        session.progress = (session.uploadedChunks / session.totalChunks) * 100;
      }
      
      // Update session status
      session.status = 'uploading';
      session.lastUpdated = new Date();
      
      // Save updated session
      await this.saveUploadSession(session);
      
      // Add to active uploads and update UI
      this.activeUploads.set(session.uploadId, session);
      this.updateProgressState(session);
      
      // Start upload with existing chunks
      return this.startUpload(session);
    } catch (error) {
      console.error('Error resuming upload:', error);
      throw error;
    }
  }

  private async startUpload(session: UploadSession): Promise<string> {
    try {
      session.status = 'uploading';
      this.updateProgressState(session);
      
      // Get chunks that need to be uploaded
      const remainingChunks = session.chunks.filter(chunk => !chunk.uploaded);
      
      // Upload chunks concurrently
      const chunkObservables = remainingChunks.map(chunk => 
        this.uploadChunk(session, chunk)
          .pipe(
            catchError(error => {
              console.error(`Error uploading chunk ${chunk.index}:`, error);
              chunk.retries++;
              
              if (chunk.retries <= this.RETRY_ATTEMPTS) {
                // Try again after delay
                return new Observable<boolean>(observer => {
                  setTimeout(() => {
                    this.uploadChunk(session, chunk).subscribe({
                      next: result => observer.next(result),
                      error: err => observer.error(err),
                      complete: () => observer.complete()
                    });
                  }, this.RETRY_DELAY);
                });
              }
              
              // Mark session as error if max retries reached
              session.status = 'error';
              session.error = `Failed to upload chunk ${chunk.index} after ${this.RETRY_ATTEMPTS} attempts`;
              this.updateProgressState(session);
              
              return throwError(() => new Error(`Failed to upload chunk ${chunk.index} after ${this.RETRY_ATTEMPTS} attempts`));
            })
          )
      );

      // Process chunks in batches to limit concurrency
      const batches = [];
      for (let i = 0; i < chunkObservables.length; i += this.MAX_CONCURRENT_UPLOADS) {
        const batch = chunkObservables.slice(i, i + this.MAX_CONCURRENT_UPLOADS);
        batches.push(batch);
      }

      // Process each batch sequentially
      for (const batch of batches) {
        // Wait for all chunks in the batch to complete
        await Promise.all(batch.map(observable => observable.toPromise()));
        
        // Check if we encountered an error
        if (session.status === 'error') {
          throw new Error(session.error);
        }
        
        // Save progress
        await this.saveUploadSession(session);
      }
      
      // Complete upload
      const completeRequest: UploadCompleteRequest = {
        uploadId: session.uploadId,
        finalChecksum: session.checksum
      };
      
      const completeResponse = await this.completeUpload(completeRequest).toPromise();
      if (!completeResponse || !completeResponse.success) {
        throw new Error(completeResponse?.errorMessage || 'Failed to complete upload');
      }
      
      // Update session status
      session.status = 'completed';
      session.progress = 100;
      session.uploadedChunks = session.totalChunks;
      this.updateProgressState(session);
      
      // Save final status
      await this.saveUploadSession(session);
      
      return session.uploadId;
    } catch (error) {
      console.error('Error during upload:', error);
      
      // Update session status
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error during upload';
      this.updateProgressState(session);
      
      // Save error status
      await this.saveUploadSession(session);
      
      throw error;
    }
  }

  private uploadChunk(session: UploadSession, chunk: ChunkMetadata): Observable<boolean> {
    const { uploadId } = session;
    const { index: chunkNumber, start, end } = chunk;
    
    // Create a slice of the file
    const fileSlice = session.file.slice(start, end);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileSlice, `${session.file.name}.part${chunkNumber}`);
    
    // Create request object
    const request: ChunkUploadRequest = {
      uploadId,
      chunkNumber
    };
    
    // Append request parameters to form data
    formData.append('uploadId', request.uploadId);
    formData.append('chunkNumber', request.chunkNumber.toString());
    
    if (chunk.checksum) {
      formData.append('checksum', chunk.checksum);
      request.checksum = chunk.checksum;
    }
    
    // Simulate timeout for testing if enabled
    if (this.SIMULATE_TIMEOUT && Math.random() < 0.3) {
      console.log(`Simulating timeout for chunk ${chunkNumber}`);
      return throwError(() => new Error('Simulated timeout'));
    }
    
    return this.http.post<ChunkUploadResponse>(`${this.API_URL}/upload/chunk`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      filter(event => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const chunkProgress = Math.round((event.loaded / event.total) * 100);
          this.updateChunkProgress(session, chunkNumber, chunkProgress);
        } else if (event.type === HttpEventType.Response) {
          const response = event.body as ChunkUploadResponse;
          
          if (response && response.success) {
            // Mark chunk as uploaded
            chunk.uploaded = true;
            session.uploadedChunks++;
            session.progress = (session.uploadedChunks / session.totalChunks) * 100;
            this.updateProgressState(session);
            
            return true;
          } else {
            throw new Error(`Chunk upload failed: ${chunkNumber}`);
          }
        }
        
        return false;
      }),
      catchError(error => {
        console.error(`Error uploading chunk ${chunkNumber}:`, error);
        return throwError(() => error);
      })
    );
  }

  private updateChunkProgress(session: UploadSession, chunkNumber: number, progress: number): void {
    // For simplicity, we'll just update the overall progress with completed chunks
    // A more sophisticated approach would track individual chunk progress
    this.updateProgressState(session);
  }

  private updateProgressState(session: UploadSession): void {
    const currentProgress = this.uploadProgress$.value;
    
    // Find existing progress entry or create new one
    const existingIndex = currentProgress.findIndex(p => p.uploadId === session.uploadId);
    
    const progressEntry: UploadProgress = {
      uploadId: session.uploadId,
      fileName: session.file.name,
      fileSize: session.file.size,
      progress: session.progress,
      uploaded: Math.floor((session.progress / 100) * session.file.size),
      status: session.status,
      error: session.error
    };
    
    if (existingIndex >= 0) {
      currentProgress[existingIndex] = progressEntry;
    } else {
      currentProgress.push(progressEntry);
    }
    
    this.uploadProgress$.next([...currentProgress]);
  }

  pauseUpload(uploadId: string): void {
    const session = this.activeUploads.get(uploadId);
    if (session && session.status === 'uploading') {
      session.status = 'paused';
      this.updateProgressState(session);
      this.saveUploadSession(session);
    }
  }

  resumePausedUpload(uploadId: string): void {
    const session = this.activeUploads.get(uploadId);
    if (session && session.status === 'paused') {
      this.startUpload(session).catch(error => {
        console.error('Error resuming upload:', error);
      });
    }
  }

  async cancelUpload(uploadId: string): Promise<boolean> {
    try {
      // Cancel on server
      await this.http.delete(`${this.API_URL}/upload/${uploadId}`).toPromise();
      
      // Remove from active uploads
      this.activeUploads.delete(uploadId);
      
      // Remove from progress state
      const currentProgress = this.uploadProgress$.value;
      const updatedProgress = currentProgress.filter(p => p.uploadId !== uploadId);
      this.uploadProgress$.next(updatedProgress);
      
      // Remove from IndexedDB
      await this.removeUploadSession(uploadId);
      
      return true;
    } catch (error) {
      console.error('Error canceling upload:', error);
      return false;
    }
  }

  getUploadStatus(uploadId: string): Observable<UploadStatusResponse> {
    return this.http.get<UploadStatusResponse>(`${this.API_URL}/upload/status/${uploadId}`);
  }

  private initializeUpload(request: UploadInitiateRequest): Observable<UploadInitiateResponse> {
    return this.http.post<UploadInitiateResponse>(`${this.API_URL}/upload/initiate`, request);
  }

  private completeUpload(request: UploadCompleteRequest): Observable<UploadCompleteResponse> {
    return this.http.post<UploadCompleteResponse>(`${this.API_URL}/upload/complete`, request);
  }

  private createChunks(file: File, chunkSize: number, totalChunks: number): ChunkMetadata[] {
    const chunks: ChunkMetadata[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      
      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        uploaded: false,
        retries: 0
      });
    }
    
    return chunks;
  }

  private async calculateFileChecksum(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunkSize = 2097152; // 2MB chunks for hash calculation
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      
      let currentChunk = 0;
      const chunks = Math.ceil(file.size / chunkSize);
      
      fileReader.onload = (e: any) => {
        spark.append(e.target.result);
        currentChunk++;
        
        if (currentChunk < chunks) {
          loadNext();
        } else {
          const checksum = spark.end();
          resolve(checksum);
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Failed to calculate checksum'));
      };
      
      function loadNext() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        fileReader.readAsArrayBuffer(file.slice(start, end));
      }
      
      loadNext();
    });
  }

  private async saveUploadSession(session: UploadSession): Promise<void> {
    try {
      // Get existing session IDs
      const sessionIds: string[] = await get('uploadSessions') || [];
      
      // Add this session if not already in the list
      if (!sessionIds.includes(session.uploadId)) {
        sessionIds.push(session.uploadId);
        await set('uploadSessions', sessionIds);
      }
      
      // Save/update the session
      await set(`upload_${session.uploadId}`, session);
    } catch (error) {
      console.error('Error saving upload session:', error);
    }
  }

  private async removeUploadSession(uploadId: string): Promise<void> {
    try {
      // Get existing session IDs
      const sessionIds: string[] = await get('uploadSessions') || [];
      
      // Remove this session
      const updatedIds = sessionIds.filter(id => id !== uploadId);
      await set('uploadSessions', updatedIds);
      
      // Remove the session data
      await del(`upload_${uploadId}`);
    } catch (error) {
      console.error('Error removing upload session:', error);
    }
  }
}
