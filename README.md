# Angular + .NET 8 Resumable Upload POC

This proof of concept demonstrates how to implement large file uploads (1GB+) using Angular with Service Workers and .NET 8 backend, with the ability to resume uploads after timeouts or network interruptions.

## Features

- ✅ Upload large files (1GB+) with progress tracking
- ✅ Chunk-based file upload strategy
- ✅ Automatic resume after connection interruption
- ✅ Background processing with Service Workers
- ✅ Graceful timeout handling
- ✅ Client-side checksum validation
- ✅ Server-side file assembly and verification

## Architecture

### Frontend (Angular)
- Angular 17+ application
- Service Worker for background processing
- Chunk management and tracking
- Implements retry and resume logic
- Stores upload state in IndexedDB for persistence

### Backend (.NET 8)
- ASP.NET Core 8 Web API
- Chunk handling and reassembly
- File integrity verification
- Supports concurrent uploads
- Efficient I/O handling for large files

## How It Works

1. **File Preparation**: The file is divided into manageable chunks (default 5MB)
2. **Chunk Metadata**: Each chunk is assigned a unique ID, sequence number, and checksum
3. **Upload Process**: Chunks are uploaded sequentially or in parallel (configurable)
4. **Service Worker**: Manages the upload process in the background
5. **Progress Tracking**: Real-time progress updates to the UI
6. **Resume Capability**: In case of interruption, upload resumes from the last successfully uploaded chunk
7. **Server-side Assembly**: The backend reassembles the chunks into the complete file
8. **Verification**: Both client and server verify file integrity

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Angular CLI](https://cli.angular.io/) (v17+)
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### Setup Instructions

1. Clone this repository
   ```bash
   git clone https://github.com/glglak/angular-dotnet8-resumable-upload-poc.git
   cd angular-dotnet8-resumable-upload-poc
   ```

2. Set up the backend
   ```bash
   cd server/ResumableUpload.API
   dotnet restore
   dotnet build
   dotnet run
   ```

3. Set up the frontend
   ```bash
   cd client
   npm install
   ng serve
   ```

4. Open your browser and navigate to `http://localhost:4200`

## Configuration Options

The application provides several configuration options:

### Frontend Configuration (`client/src/environments/environment.ts`)
- `chunkSize`: Size of each chunk in bytes (default: 5MB)
- `maxConcurrentUploads`: Maximum number of chunks to upload simultaneously (default: 3)
- `retryAttempts`: Number of retry attempts for failed chunks (default: 5)
- `retryDelay`: Delay between retries in milliseconds (default: 1000)
- `simulateTimeout`: Set to true to randomly simulate connection issues (for testing)

### Backend Configuration (`server/ResumableUpload.API/appsettings.json`)
- `UploadSettings:ChunkStoragePath`: Temporary storage location for chunks
- `UploadSettings:CompletedFilesPath`: Storage location for completed files
- `UploadSettings:MaxRequestSize`: Maximum request size (default: 10MB)
- `UploadSettings:AllowedExtensions`: List of allowed file extensions

## Testing Resilience

The POC includes utilities to test the resume capability:

1. **Network Throttling**: Use browser DevTools to simulate slow connections
2. **Timeout Simulation**: Enable artificial timeout simulation in the frontend configuration
3. **Connection Interruption**: The UI provides a "Simulate Connection Loss" button to test resume functionality

## API Endpoints

- `POST /api/upload/initiate`: Initiates a new upload session
- `POST /api/upload/chunk`: Uploads a single chunk
- `GET /api/upload/status/{id}`: Gets the status of an upload
- `POST /api/upload/complete`: Completes an upload, triggering assembly
- `DELETE /api/upload/{id}`: Cancels an upload and cleans up chunks

## Implementation Details

### Frontend
- **File Chunking**: Uses browser's `File.slice()` API to divide large files into manageable chunks
- **Checksum Generation**: Implements SparkMD5 to calculate checksums for integrity verification
- **Upload Management**: Tracks upload state, progress, and handles retries with the service
- **IndexedDB Storage**: Persists upload sessions using idb-keyval for resuming after page refresh
- **Service Worker**: Handles uploads in the background, enabling continued uploading even when the app isn't the active tab
- **Parallel Processing**: Configurable concurrent chunk uploads with throttling to avoid overwhelming the server

### Backend
- **In-Memory Session Tracking**: Maintains upload session state for active uploads
- **Efficient File I/O**: Uses non-blocking async operations for chunk handling
- **Atomic Operations**: Ensures file integrity throughout the upload process
- **Cleanup Service**: Background service that manages expired uploads to free up resources
- **Checksum Verification**: Validates file integrity during reassembly

## Best Practices

1. **Progressive Enhancement**: Falls back to standard uploads if Service Workers aren't supported
2. **Memory Management**: Processes chunks in a streaming fashion to handle very large files
3. **Error Handling**: Comprehensive error handling with retry mechanisms
4. **User Feedback**: Clear progress indication and meaningful error messages
5. **Resource Cleanup**: Automated cleanup of temporary files and expired uploads

## Notes for Production Use

While this POC demonstrates the core functionality of resumable uploads, additional considerations for production use include:

- User authentication and authorization
- Rate limiting and quotas
- S3/Azure Blob Storage integration for scalable storage
- Database persistence for upload sessions instead of in-memory storage
- Comprehensive logging and monitoring
- CDN integration for static assets

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
