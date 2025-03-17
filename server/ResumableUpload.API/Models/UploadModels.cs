namespace ResumableUpload.API.Models;

public class UploadInitiateRequest
{
    public required string FileName { get; set; }
    public required long FileSize { get; set; }
    public int ChunkSize { get; set; } = 5 * 1024 * 1024; // Default: 5MB
    public string? ContentType { get; set; }
    public string? Checksum { get; set; }
}

public class UploadInitiateResponse
{
    public required string UploadId { get; set; }
    public required string FileName { get; set; }
    public long FileSize { get; set; }
    public int ChunkSize { get; set; }
    public int TotalChunks { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class ChunkUploadRequest
{
    public required string UploadId { get; set; }
    public required int ChunkNumber { get; set; }
    public string? Checksum { get; set; }
}

public class ChunkUploadResponse
{
    public required string UploadId { get; set; }
    public int ChunkNumber { get; set; }
    public bool Success { get; set; }
    public bool IsComplete { get; set; }
    public int ReceivedChunks { get; set; }
    public int TotalChunks { get; set; }
}

public class UploadStatusResponse
{
    public required string UploadId { get; set; }
    public required string FileName { get; set; }
    public long FileSize { get; set; }
    public UploadState State { get; set; }
    public int ReceivedChunks { get; set; }
    public int TotalChunks { get; set; }
    public List<int> MissingChunks { get; set; } = new List<int>();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class UploadCompleteRequest
{
    public required string UploadId { get; set; }
    public string? FinalChecksum { get; set; }
}

public class UploadCompleteResponse
{
    public required string UploadId { get; set; }
    public required string FileName { get; set; }
    public long FileSize { get; set; }
    public bool Success { get; set; }
    public string? FilePath { get; set; }
    public string? ErrorMessage { get; set; }
    public bool ChecksumVerified { get; set; }
}

public enum UploadState
{
    Initiated,
    InProgress,
    Completed,
    Failed,
    Expired
}

public class UploadSession
{
    public required string UploadId { get; set; }
    public required string FileName { get; set; }
    public required long FileSize { get; set; }
    public int ChunkSize { get; set; }
    public int TotalChunks { get; set; }
    public UploadState State { get; set; } = UploadState.Initiated;
    public HashSet<int> ReceivedChunks { get; set; } = new HashSet<int>();
    public string? ContentType { get; set; }
    public string? Checksum { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}
