# Storage System

The worker service includes a flexible storage abstraction layer that supports both local file system and S3-compatible object storage.

## Features

- **Multiple Backends**: Local filesystem or S3-compatible storage
- **Unified API**: Single interface for all storage operations
- **Easy Switching**: Change storage backend via environment variables
- **Docker Volumes**: Persistent storage with Docker
- **CDN Support**: Nginx-based CDN for static content delivery

## Storage Adapters

### LocalStorageAdapter

Stores files on the local file system.

**Configuration:**
```typescript
{
  type: 'local',
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage'
}
```

**Features:**
- Directory auto-creation
- Atomic file writes
- Efficient file operations

### S3StorageAdapter

Stores files in AWS S3 or compatible storage (MinIO, Wasabi, etc.).

**Configuration:**
```typescript
{
  type: 's3',
  baseUrl: 'https://cdn.example.com', // Optional CDN URL
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    endpoint: 'https://s3.amazonaws.com', // Optional for S3 alternatives
    accessKeyId: 'xxx',
    secretAccessKey: 'yyy'
  }
}
```

**Features:**
- Streaming uploads/downloads
- Automatic retry logic
- Multipart upload support (via AWS SDK)

## API Reference

### StorageAdapter Interface

```typescript
interface StorageAdapter {
  // Upload a file
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  
  // Download a file
  download(key: string): Promise<Buffer>;
  
  // Check if file exists
  exists(key: string): Promise<boolean>;
  
  // Delete a file
  delete(key: string): Promise<void>;
  
  // Get public URL for a file
  getPublicUrl(key: string): string;
}
```

### StorageFactory

```typescript
import { StorageFactory, StorageConfig } from './storage';

const storage = StorageFactory.createAdapter(config);
```

## Usage Examples

### Basic Upload/Download

```typescript
import { StorageFactory } from './storage';

const storage = StorageFactory.createAdapter({
  type: 'local',
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage',
});

// Upload
const buffer = Buffer.from('Hello, World!');
const url = await storage.upload('test/file.txt', buffer, 'text/plain');
console.log('Uploaded to:', url);

// Download
const downloaded = await storage.download('test/file.txt');
console.log('Downloaded:', downloaded.toString());

// Check existence
const exists = await storage.exists('test/file.txt');
console.log('Exists:', exists);

// Delete
await storage.delete('test/file.txt');
```

### Image Processing

The `ImageProcessor` automatically uses the configured storage:

```typescript
import { ImageProcessor } from './processors/image-processor';
import { StorageConfig } from './storage';

const storageConfig: StorageConfig = {
  type: 'local',
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage',
};

const processor = new ImageProcessor(storageConfig, monitoring);

const result = await processor.processImage({
  id: 'job-123',
  tool: ImageTool.DALL_E,
  sourceUrl: 'https://example.com/image.jpg',
  userId: 'user-123',
});

// Access processed images
console.log('Normal quality:', result.variants[0].url);
console.log('High quality:', result.variants[1].url);
```

### Switch Between Storage Types

```typescript
// Development - Local storage
const devStorage = StorageFactory.createAdapter({
  type: 'local',
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage',
});

// Production - S3 storage
const prodStorage = StorageFactory.createAdapter({
  type: 's3',
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

## Directory Structure

Local storage organizes files by purpose:

```
/var/www/storage/
├── uploads/          # User-uploaded content
├── generated/        # AI-generated content
└── processed/        # Post-processed images
    ├── dall-e/
    │   └── user-123/
    │       └── job-456/
    │           ├── normal-123456.jpg
    │           └── high-quality-123456.webp
    ├── sora/
    └── stable-diffusion/
```

## Environment Variables

```bash
# Storage type: 'local' or 's3'
STORAGE_TYPE=local

# Base URL for serving static files
STORAGE_BASE_URL=http://localhost/static

# Local storage path (when STORAGE_TYPE=local)
STORAGE_LOCAL_PATH=/var/www/storage

# S3 configuration (when STORAGE_TYPE=s3)
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=yyy
```

## Docker Integration

All services mount the same storage volumes:

```yaml
volumes:
  - storage_uploads:/var/www/storage/uploads
  - storage_generated:/var/www/storage/generated
  - storage_processed:/var/www/storage/processed
```

## Testing

### With Mock S3

```typescript
import { MockS3Client } from '@monorepo/test-utils';
import { S3StorageAdapter } from './storage';

const mockS3 = new MockS3Client();

const storage = new S3StorageAdapter({
  type: 's3',
  s3: {
    bucket: 'test-bucket',
    region: 'us-east-1',
  },
});

// Storage will use the mocked S3 client
```

### With Temporary Local Storage

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { LocalStorageAdapter } from './storage';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));

const storage = new LocalStorageAdapter({
  type: 'local',
  baseUrl: 'http://test/static',
  localBasePath: tmpDir,
});

// Clean up after tests
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
});
```

## Performance

### Local Storage

- **Write**: ~50MB/s on SSD
- **Read**: ~100MB/s on SSD
- **Latency**: <1ms

### S3 Storage

- **Write**: ~10-50MB/s (depends on network)
- **Read**: ~20-100MB/s (depends on network)
- **Latency**: 10-100ms

## Error Handling

All storage operations may throw errors:

```typescript
try {
  await storage.upload(key, buffer, contentType);
} catch (error) {
  if (error.code === 'ENOENT') {
    // File not found
  } else if (error.code === 'EACCES') {
    // Permission denied
  } else {
    // Other errors
  }
}
```

## Best Practices

1. **Use local storage for development** - Faster and simpler
2. **Use S3 for production** - Scalable and durable
3. **Always handle errors** - Network and disk operations can fail
4. **Use meaningful keys** - Organize by user, tool, and timestamp
5. **Set appropriate content types** - For proper browser handling
6. **Monitor storage usage** - Track disk space or S3 costs
7. **Implement cleanup policies** - Remove old/unused files

## Migration

### From Local to S3

```bash
# Backup local storage
make storage-backup

# Upload to S3
aws s3 sync /var/lib/docker/volumes/monorepo_storage_processed/_data/ \
  s3://my-bucket/processed/

# Update environment
export STORAGE_TYPE=s3
docker-compose up -d
```

### From S3 to Local

```bash
# Download from S3
aws s3 sync s3://my-bucket/processed/ ./storage/processed/

# Initialize volumes
make storage-init

# Copy to volumes
docker cp ./storage/processed/ monorepo-worker:/var/www/storage/

# Update environment
export STORAGE_TYPE=local
docker-compose up -d
```

## Troubleshooting

### Permission Denied

```bash
# Fix permissions
docker-compose exec worker chown -R node:node /var/www/storage
docker-compose exec worker chmod -R 755 /var/www/storage
```

### Out of Disk Space

```bash
# Check volume size
docker system df -v

# Clean up old files
make storage-clean
```

### S3 Connection Issues

```bash
# Test S3 access
docker-compose exec worker node -e "
  const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: 'us-east-1' });
  client.send(new ListBucketsCommand({})).then(console.log);
"
```

## See Also

- [Storage Integration Documentation](../../docs/STORAGE_INTEGRATION.md)
- [Image Post-Processing Documentation](../../docs/IMAGE_POST_PROCESSING.md)
- [Worker Service README](./README.md)
