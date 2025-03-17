export const environment = {
  production: false,
  apiUrl: 'https://localhost:7099/api',
  uploadSettings: {
    chunkSize: 5 * 1024 * 1024, // 5MB
    maxConcurrentUploads: 3,
    retryAttempts: 5,
    retryDelay: 1000, // 1 second
    simulateTimeout: false, // Set to true to test resume capability
  }
};
