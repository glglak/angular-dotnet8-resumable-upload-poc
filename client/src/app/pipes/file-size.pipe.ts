import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fileSize'
})
export class FileSizePipe implements PipeTransform {
  private units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  transform(bytes: number = 0, precision: number = 2): string {
    if (bytes === 0) {
      return '0 bytes';
    }
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(precision) + ' ' + this.units[i];
  }
}
