using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using ResumableUpload.API.Models;

namespace ResumableUpload.API.Services;

public class UploadService : IUploadService
{
    private readonly ILogger<UploadService> _logger;
    private readonly UploadSettings _settings;
    
    // In-memory storage for active upload sessions
    // Note: In a production environment, this should be persisted in a database
    private readonly ConcurrentDictionary<string, UploadSession> _activeSessions = new();

    public UploadService(ILogger<UploadService> logger, IOptions<UploadSettings> options)
    {
        _logger = logger;
        _settings = options.Value;
    }

    public async Task<UploadInitiateResponse> InitiateUploadAsync(UploadInitiateRequest request)
    {
        // Validate file extensions
        string extension = Path.GetExtension(request.FileName).ToLowerInvariant();
        if (_settings.AllowedExtensions.Count > 0 && !_settings.AllowedExtensions.Contains(extension))
        {
            throw new InvalidOperationException($"File extension {extension} is not allowed");
        }

        // Generate a unique upload ID
        string uploadId = Guid.NewGuid().ToString("N");
        
        // Calculate total chunks
        int totalChunks = (int)Math.Ceiling((double)request.FileSize / request.ChunkSize);
        
        // Create upload session
        var session = new UploadSession
        {
            UploadId = uploadId,
            FileName = Path.GetFileName(request.FileName),
            FileSize = request.FileSize,
            ChunkSize = request.ChunkSize,
            TotalChunks = totalChunks,
            ContentType = request.ContentType,
            Checksum = request.Checksum,
            ExpiresAt = DateTime.UtcNow.AddHours(24) // Sessions expire after 24 hours
        };
        
        // Add to active sessions
        _activeSessions.TryAdd(uploadId, session);
        
        // Create directory for chunks
        string uploadDirectory = Path.Combine(_settings.ChunkStoragePath, uploadId);
        Directory.CreateDirectory(uploadDirectory);
        
        return new UploadInitiateResponse
        {
            UploadId = uploadId,
            FileName = session.FileName,
            FileSize = session.FileSize,
            ChunkSize = session.ChunkSize,
            TotalChunks = session.TotalChunks,
            ExpiresAt = session.ExpiresAt
        };
    }

    public async Task<ChunkUploadResponse> ProcessChunkAsync(ChunkUploadRequest request, Stream chunkStream)
    {
        if (!_activeSessions.TryGetValue(request.UploadId, out var session))
        {
            throw new KeyNotFoundException($"Upload session not found: {request.UploadId}");
        }
        
        // Validate chunk number
        if (request.ChunkNumber < 0 || request.ChunkNumber >= session.TotalChunks)
        {
            throw new ArgumentOutOfRangeException(nameof(request.ChunkNumber), "Invalid chunk number");
        }
        
        // Save chunk
        string chunkPath = GetChunkPath(request.UploadId, request.ChunkNumber);
        
        using (var fileStream = new FileStream(chunkPath, FileMode.Create))
        {
            await chunkStream.CopyToAsync(fileStream);
        }
        
        // Optionally validate checksum
        if (!string.IsNullOrEmpty(request.Checksum))
        {
            string calculatedChecksum = await CalculateFileChecksumAsync(chunkPath);
            if (calculatedChecksum != request.Checksum)
            {
                // Remove invalid chunk
                File.Delete(chunkPath);
                throw new InvalidDataException("Checksum validation failed");
            }
        }
        
        // Update session state
        session.ReceivedChunks.Add(request.ChunkNumber);
        session.UpdatedAt = DateTime.UtcNow;
        session.State = UploadState.InProgress;
        
        // Check if all chunks are received
        bool isComplete = session.ReceivedChunks.Count == session.TotalChunks;
        
        return new ChunkUploadResponse
        {
            UploadId = request.UploadId,
            ChunkNumber = request.ChunkNumber,
            Success = true,
            IsComplete = isComplete,
            ReceivedChunks = session.ReceivedChunks.Count,
            TotalChunks = session.TotalChunks
        };
    }

    public async Task<UploadStatusResponse> GetUploadStatusAsync(string uploadId)
    {
        if (!_activeSessions.TryGetValue(uploadId, out var session))
        {
            throw new KeyNotFoundException($"Upload session not found: {uploadId}");
        }
        
        // Calculate missing chunks
        var allChunks = Enumerable.Range(0, session.TotalChunks);
        var missingChunks = allChunks.Except(session.ReceivedChunks).ToList();
        
        return new UploadStatusResponse
        {
            UploadId = session.UploadId,
            FileName = session.FileName,
            FileSize = session.FileSize,
            State = session.State,
            ReceivedChunks = session.ReceivedChunks.Count,
            TotalChunks = session.TotalChunks,
            MissingChunks = missingChunks,
            CreatedAt = session.CreatedAt,
            UpdatedAt = session.UpdatedAt,
            ExpiresAt = session.ExpiresAt
        };
    }

    public async Task<UploadCompleteResponse> CompleteUploadAsync(UploadCompleteRequest request)
    {
        if (!_activeSessions.TryGetValue(request.UploadId, out var session))
        {
            throw new KeyNotFoundException($"Upload session not found: {request.UploadId}");
        }
        
        // Ensure all chunks are received
        if (session.ReceivedChunks.Count != session.TotalChunks)
        {
            return new UploadCompleteResponse
            {
                UploadId = request.UploadId,
                FileName = session.FileName,
                FileSize = session.FileSize,
                Success = false,
                ErrorMessage = $"Not all chunks received. Got {session.ReceivedChunks.Count} of {session.TotalChunks}"
            };
        }
        
        try
        {
            // Create the final file
            string finalFilePath = Path.Combine(_settings.CompletedFilesPath, session.FileName);
            
            // Ensure unique filename
            int counter = 1;
            string fileNameWithoutExt = Path.GetFileNameWithoutExtension(session.FileName);
            string extension = Path.GetExtension(session.FileName);
            
            while (File.Exists(finalFilePath))
            {
                finalFilePath = Path.Combine(_settings.CompletedFilesPath, $"{fileNameWithoutExt}_{counter}{extension}");
                counter++;
            }
            
            // Combine chunks
            using (var outputStream = new FileStream(finalFilePath, FileMode.Create))
            {
                for (int i = 0; i < session.TotalChunks; i++)
                {
                    string chunkPath = GetChunkPath(request.UploadId, i);
                    var chunkBytes = await File.ReadAllBytesAsync(chunkPath);
                    await outputStream.WriteAsync(chunkBytes, 0, chunkBytes.Length);
                }
            }
            
            // Verify checksum if provided
            bool checksumVerified = false;
            if (!string.IsNullOrEmpty(request.FinalChecksum))
            {
                string calculatedChecksum = await CalculateFileChecksumAsync(finalFilePath);
                checksumVerified = calculatedChecksum == request.FinalChecksum;
                
                if (!checksumVerified)
                {
                    // Optionally delete the file if checksum fails
                    // File.Delete(finalFilePath);
                    
                    return new UploadCompleteResponse
                    {
                        UploadId = request.UploadId,
                        FileName = session.FileName,
                        FileSize = session.FileSize,
                        Success = false,
                        ErrorMessage = "Checksum verification failed",
                        ChecksumVerified = false
                    };
                }
            }
            
            // Update session state
            session.State = UploadState.Completed;
            session.UpdatedAt = DateTime.UtcNow;
            
            return new UploadCompleteResponse
            {
                UploadId = request.UploadId,
                FileName = session.FileName,
                FileSize = session.FileSize,
                Success = true,
                FilePath = finalFilePath,
                ChecksumVerified = checksumVerified
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing upload {UploadId}", request.UploadId);
            
            return new UploadCompleteResponse
            {
                UploadId = request.UploadId,
                FileName = session.FileName,
                FileSize = session.FileSize,
                Success = false,
                ErrorMessage = $"Error completing upload: {ex.Message}"
            };
        }
    }

    public async Task<bool> CancelUploadAsync(string uploadId)
    {
        if (!_activeSessions.TryGetValue(uploadId, out var session))
        {
            return false;
        }
        
        try
        {
            // Remove upload directory with all chunks
            string uploadDirectory = Path.Combine(_settings.ChunkStoragePath, uploadId);
            if (Directory.Exists(uploadDirectory))
            {
                Directory.Delete(uploadDirectory, true);
            }
            
            // Remove from active sessions
            _activeSessions.TryRemove(uploadId, out _);
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error canceling upload {UploadId}", uploadId);
            return false;
        }
    }

    public async Task CleanupExpiredUploadsAsync()
    {
        var now = DateTime.UtcNow;
        var expiredSessions = _activeSessions.Values
            .Where(s => s.ExpiresAt < now)
            .ToList();
        
        foreach (var session in expiredSessions)
        {
            await CancelUploadAsync(session.UploadId);
        }
    }
    
    private string GetChunkPath(string uploadId, int chunkNumber)
    {
        string uploadDirectory = Path.Combine(_settings.ChunkStoragePath, uploadId);
        return Path.Combine(uploadDirectory, $"chunk_{chunkNumber:D5}");
    }
    
    private async Task<string> CalculateFileChecksumAsync(string filePath)
    {
        using var md5 = MD5.Create();
        using var stream = File.OpenRead(filePath);
        var hash = await md5.ComputeHashAsync(stream);
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }
}
