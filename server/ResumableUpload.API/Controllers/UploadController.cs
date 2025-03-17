using Microsoft.AspNetCore.Mvc;
using ResumableUpload.API.Models;
using ResumableUpload.API.Services;

namespace ResumableUpload.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly IUploadService _uploadService;
    private readonly ILogger<UploadController> _logger;

    public UploadController(IUploadService uploadService, ILogger<UploadController> logger)
    {
        _uploadService = uploadService;
        _logger = logger;
    }

    [HttpPost("initiate")]
    public async Task<ActionResult<UploadInitiateResponse>> InitiateUpload(UploadInitiateRequest request)
    {
        try
        {
            var response = await _uploadService.InitiateUploadAsync(request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating upload");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("chunk")]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100MB max chunk size
    [RequestFormLimits(MultipartBodyLengthLimit = 100 * 1024 * 1024)]
    public async Task<ActionResult<ChunkUploadResponse>> UploadChunk([FromForm] ChunkUploadRequest request, IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file was provided" });
            }

            using var stream = file.OpenReadStream();
            var response = await _uploadService.ProcessChunkAsync(request, stream);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Upload session not found");
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading chunk");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("status/{uploadId}")]
    public async Task<ActionResult<UploadStatusResponse>> GetUploadStatus(string uploadId)
    {
        try
        {
            var response = await _uploadService.GetUploadStatusAsync(uploadId);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Upload session not found");
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting upload status");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("complete")]
    public async Task<ActionResult<UploadCompleteResponse>> CompleteUpload(UploadCompleteRequest request)
    {
        try
        {
            var response = await _uploadService.CompleteUploadAsync(request);
            if (!response.Success)
            {
                return BadRequest(response);
            }
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Upload session not found");
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing upload");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{uploadId}")]
    public async Task<ActionResult> CancelUpload(string uploadId)
    {
        try
        {
            bool result = await _uploadService.CancelUploadAsync(uploadId);
            if (!result)
            {
                return NotFound(new { error = $"Upload session not found: {uploadId}" });
            }
            return Ok(new { message = "Upload canceled successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error canceling upload");
            return BadRequest(new { error = ex.Message });
        }
    }
}
