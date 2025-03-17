var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Angular client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularClient",
        policy => 
        {
            policy.WithOrigins("http://localhost:4200")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// Add upload settings configuration
builder.Services.Configure<UploadSettings>(
    builder.Configuration.GetSection("UploadSettings"));

// Register services
builder.Services.AddSingleton<IUploadService, UploadService>();

var app = builder.Build();

// Create directories for uploads if they don't exist
var uploadSettings = app.Services.GetRequiredService<IOptions<UploadSettings>>().Value;
Directory.CreateDirectory(uploadSettings.ChunkStoragePath);
Directory.CreateDirectory(uploadSettings.CompletedFilesPath);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngularClient");
app.UseAuthorization();
app.MapControllers();

app.Run();

// Add upload settings class for dependency injection
public class UploadSettings
{
    public string ChunkStoragePath { get; set; } = string.Empty;
    public string CompletedFilesPath { get; set; } = string.Empty;
    public long MaxRequestSize { get; set; } = 10 * 1024 * 1024; // Default: 10MB
    public List<string> AllowedExtensions { get; set; } = new List<string>();
}
