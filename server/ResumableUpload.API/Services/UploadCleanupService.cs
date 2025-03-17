namespace ResumableUpload.API.Services;

public class UploadCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<UploadCleanupService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(1);

    public UploadCleanupService(
        IServiceProvider serviceProvider,
        ILogger<UploadCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Upload Cleanup Service is starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Upload Cleanup Service is running cleanup");

            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var uploadService = scope.ServiceProvider.GetRequiredService<IUploadService>();
                    await uploadService.CleanupExpiredUploadsAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while cleaning up expired uploads");
            }

            _logger.LogInformation("Upload Cleanup Service is waiting for next cleanup cycle");
            await Task.Delay(_interval, stoppingToken);
        }

        _logger.LogInformation("Upload Cleanup Service is stopping");
    }
}
