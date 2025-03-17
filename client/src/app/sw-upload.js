// This will be incorporated into the main service worker
// For demonstration purposes, this shows how the upload could be handled in a service worker

// Handle upload messages
self.addEventListener('message', (event) => {
  if (event.data.type === 'UPLOAD_CHUNK') {
    uploadChunk(event.data.payload)
      .then(response => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CHUNK_UPLOADED',
              payload: {
                uploadId: event.data.payload.uploadId,
                chunkNumber: event.data.payload.chunkNumber,
                success: true,
                response
              }
            });
          });
        });
      })
      .catch(error => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CHUNK_UPLOAD_FAILED',
              payload: {
                uploadId: event.data.payload.uploadId,
                chunkNumber: event.data.payload.chunkNumber,
                error: error.message
              }
            });
          });
        });
      });
  }
});

// Function to upload a chunk
async function uploadChunk(data) {
  const { uploadId, chunkNumber, file, start, end, apiUrl } = data;
  
  // Create a slice of the file
  const chunk = file.slice(start, end);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', chunk, `${file.name}.part${chunkNumber}`);
  formData.append('uploadId', uploadId);
  formData.append('chunkNumber', chunkNumber.toString());
  
  if (data.checksum) {
    formData.append('checksum', data.checksum);
  }
  
  // Upload the chunk
  const response = await fetch(`${apiUrl}/upload/chunk`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload chunk: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

// Handle network connectivity changes
self.addEventListener('online', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS',
        payload: { online: true }
      });
    });
  });
});

self.addEventListener('offline', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS',
        payload: { online: false }
      });
    });
  });
});
