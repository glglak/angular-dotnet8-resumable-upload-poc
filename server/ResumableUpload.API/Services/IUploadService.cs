using ResumableUpload.API.Models;

namespace ResumableUpload.API.Services;

public interface IUploadService
{
    /// <summary>
    /// Initiates a new upload session
    /// </summary>
    Task<UploadInitiateResponse> InitiateUploadAsync(UploadInitiateRequest request);
    
    /// <summary>
    /// Processes a single chunk upload
    /// </summary>
    Task<ChunkUploadResponse> ProcessChunkAsync(ChunkUploadRequest request, Stream chunkStream);
    
    /// <summary>
    /// Gets the status of an upload
    /// </summary>
    Task<UploadStatusResponse> GetUploadStatusAsync(string uploadId);
    
    /// <summary>
    /// Completes the upload process and assembles the final file
    /// </summary>
    Task<UploadCompleteResponse> CompleteUploadAsync(UploadCompleteRequest request);
    
    /// <summary>
    /// Cancels an upload and removes all chunks
    /// </summary>
    Task<bool> CancelUploadAsync(string uploadId);
    
    /// <summary>
    /// Cleans up expired upload sessions
    /// </summary>
    Task CleanupExpiredUploadsAsync();
}
