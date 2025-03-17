import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadProgress } from '../../models/upload.models';

@Component({
  selector: 'app-upload-list',
  templateUrl: './upload-list.component.html',
  styleUrls: ['./upload-list.component.scss']
})
export class UploadListComponent {
  @Input() uploads: UploadProgress[] = [];
  @Output() cancelUpload = new EventEmitter<string>();
  @Output() pauseUpload = new EventEmitter<string>();
  @Output() resumeUpload = new EventEmitter<string>();
  
  trackByUploadId(index: number, upload: UploadProgress): string {
    return upload.uploadId;
  }
  
  onCancelClick(uploadId: string, event: Event): void {
    event.stopPropagation();
    this.cancelUpload.emit(uploadId);
  }
  
  onPauseClick(uploadId: string, event: Event): void {
    event.stopPropagation();
    this.pauseUpload.emit(uploadId);
  }
  
  onResumeClick(uploadId: string, event: Event): void {
    event.stopPropagation();
    this.resumeUpload.emit(uploadId);
  }
  
  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'uploading': return 'Uploading';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return status;
    }
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'uploading': return 'status-uploading';
      case 'paused': return 'status-paused';
      case 'completed': return 'status-completed';
      case 'error': return 'status-error';
      default: return '';
    }
  }
}
