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
   cd server
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

### Backend Configuration (`server/appsettings.json`)
- `UploadSettings:ChunkStoragePath`: Temporary storage location for chunks
- `UploadSettings:CompletedFilesPath`: Storage location for completed files
- `UploadSettings:MaxRequestSize`: Maximum request size (default: 10MB)
- `UploadSettings:AllowedExtensions`: List of allowed file extensions

## Testing Resilience

The POC includes utilities to test the resume capability:

1. **Network Throttling**: Use browser DevTools to simulate slow connections
2. **Timeout Simulation**: Enable artificial timeout simulation in the configuration
3. **Connection Interruption**: The UI provides a button to simulate connection loss

## API Endpoints

- `POST /api/upload/initiate`: Initiates a new upload session
- `POST /api/upload/chunk`: Uploads a single chunk
- `GET /api/upload/status/{id}`: Gets the status of an upload
- `POST /api/upload/complete`: Completes an upload, triggering assembly
- `DELETE /api/upload/{id}`: Cancels an upload and cleans up chunks

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
