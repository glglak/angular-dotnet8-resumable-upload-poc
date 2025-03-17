import { Component } from '@angular/core';
import { UploadProgress } from './models/upload.models';
import { UploadService } from './services/upload.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Resumable Upload POC';
  uploadProgress: UploadProgress[] = [];
  
  constructor(private uploadService: UploadService) {
    this.uploadService.getUploadProgress().subscribe(progress => {
      this.uploadProgress = progress;
    });
  }
  
  onFileSelected(file: File): void {
    this.uploadService.uploadFile(file)
      .catch(error => console.error('Error uploading file:', error));
  }
  
  onCancelUpload(uploadId: string): void {
    this.uploadService.cancelUpload(uploadId)
      .catch(error => console.error('Error canceling upload:', error));
  }
  
  onPauseUpload(uploadId: string): void {
    this.uploadService.pauseUpload(uploadId);
  }
  
  onResumeUpload(uploadId: string): void {
    this.uploadService.resumePausedUpload(uploadId);
  }
  
  simulateConnectionLoss(): void {
    // This is for demonstration purposes
    // In a real implementation, we would let the service worker handle this
    console.log('Simulating connection loss');
    
    // Find an active upload
    const activeUpload = this.uploadProgress.find(p => p.status === 'uploading');
    if (activeUpload) {
      // Pause it
      this.uploadService.pauseUpload(activeUpload.uploadId);
      
      // Resume after 3 seconds
      setTimeout(() => {
        console.log('Simulating connection recovery');
        this.uploadService.resumePausedUpload(activeUpload.uploadId);
      }, 3000);
    } else {
      console.log('No active uploads to simulate connection loss');
    }
  }
}
