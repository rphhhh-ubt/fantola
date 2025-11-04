# Storage Integration

This document describes the storage integration system for handling file uploads, AI-generated content, and processed images.

## Overview

The system supports two storage backends:
- **Local File System**: Files stored on local disk with Nginx CDN
- **S3-Compatible Storage**: AWS S3 or compatible object storage (MinIO, Wasabi, etc.)

## Architecture

### Directory Structure

```
/var/www/storage/
├── uploads/        # User-uploaded content
├── generated/      # AI-generated content (images, videos, etc.)
└── processed/      # Post-processed images (variants)
```

### Components

1. **Storage Adapters**: Abstraction layer supporting multiple backends
   - `LocalStorageAdapter`: Local file system operations
   - `S3StorageAdapter`: S3-compatible storage operations
   - `StorageFactory`: Factory for creating appropriate adapter

2. **Nginx CDN**: Serves static files with caching and compression
   - Cache duration: 7 days for uploads, 30 days for generated/processed
   - Gzip compression enabled for all image types
   - CORS headers for cross-origin access
   - Security: Directory listing disabled

3. **Docker Volumes**: Persistent storage across container restarts
   - `storage_uploads`: User uploads
   - `storage_generated`: AI-generated content
   - `storage_processed`: Processed image variants

## Configuration

### Environment Variables

```bash
# Storage backend type: 'local' or 's3'
STORAGE_TYPE=local

# Base URL for serving static files
STORAGE_BASE_URL=http://localhost/static

# Local storage path (when STORAGE_TYPE=local)
STORAGE_LOCAL_PATH=/var/www/storage

# S3 Configuration (when STORAGE_TYPE=s3)
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

### Docker Compose

All services (api, bot, worker) mount the same storage volumes:

```yaml
volumes:
  - storage_uploads:/var/www/storage/uploads
  - storage_generated:/var/www/storage/generated
  - storage_processed:/var/www/storage/processed
```

Nginx mounts volumes in read-only mode:

```yaml
volumes:
  - storage_uploads:/var/www/storage/uploads:ro
  - storage_generated:/var/www/storage/generated:ro
  - storage_processed:/var/www/storage/processed:ro
```

## Usage

### Worker Service

The worker service uses the storage abstraction for image processing:

```typescript
import { StorageConfig, StorageFactory } from './storage';

const storageConfig: StorageConfig = {
  type: 'local', // or 's3'
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage',
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    // ... other S3 config
  },
};

const storage = StorageFactory.createAdapter(storageConfig);

// Upload file
const url = await storage.upload(
  'processed/dall-e/user-123/job-456/normal-123456.jpg',
  buffer,
  'image/jpeg'
);

// Download file
const buffer = await storage.download('processed/dall-e/user-123/job-456/normal-123456.jpg');

// Check if file exists
const exists = await storage.exists('path/to/file.jpg');

// Delete file
await storage.delete('path/to/file.jpg');

// Get public URL
const url = storage.getPublicUrl('path/to/file.jpg');
```

### Image Processor

The image processor automatically uses the configured storage:

```typescript
import { ImageProcessor } from './processors/image-processor';

const processor = new ImageProcessor(storageConfig, monitoring);

const result = await processor.processImage({
  id: 'job-123',
  tool: ImageTool.DALL_E,
  sourceUrl: 'https://example.com/image.jpg',
  userId: 'user-123',
});

// result.variants[0].url - Normal quality variant URL
// result.variants[1].url - High quality variant URL
```

## Nginx Configuration

### Static File Locations

- `/static/uploads/*` → `/var/www/storage/uploads/`
- `/static/generated/*` → `/var/www/storage/generated/`
- `/static/processed/*` → `/var/www/storage/processed/`

### Cache Headers

**Uploads** (user content, may be deleted):
- Cache-Control: `public, immutable`
- Expires: 7 days

**Generated & Processed** (permanent content):
- Cache-Control: `public, immutable`
- Expires: 30 days

### Compression

Gzip enabled for:
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

### Security

- Directory listing: Disabled (`autoindex off`)
- X-Content-Type-Options: `nosniff`
- CORS: Allow all origins for GET/HEAD/OPTIONS

## File Permissions

All storage directories are created with:
- Owner: `node:node` (1000:1000)
- Permissions: `755` (rwxr-xr-x)
- Files created with default umask

## Deployment

### Local Storage (Default)

```bash
# Start services with local storage
docker-compose up -d

# Start with Nginx CDN
docker-compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
```

### S3 Storage

```bash
# Set environment variables
export STORAGE_TYPE=s3
export S3_BUCKET=my-bucket
export S3_ACCESS_KEY_ID=xxx
export S3_SECRET_ACCESS_KEY=yyy

# Start services
docker-compose up -d
```

### Hybrid Setup

You can use local storage for uploads and S3 for generated content by configuring different storage types per service.

## Backup

### Local Storage

Volumes persist on the host machine:

```bash
# Find volume location
docker volume inspect monorepo_storage_uploads

# Backup volumes
docker run --rm \
  -v monorepo_storage_uploads:/source \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /source .
```

### S3 Storage

Use S3 versioning and lifecycle policies:

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled

# Set lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration file://lifecycle.json
```

## Monitoring

Storage operations are tracked via the monitoring package:

- **Success**: `generation_success` KPI with type `image_processing`
- **Failure**: `generation_failure` KPI with error details
- **Metrics**: Processing time, file sizes, compression ratios

## Testing

The storage adapters support both S3 and local storage:

```typescript
import { MockS3Client } from '@monorepo/test-utils';
import { LocalStorageAdapter } from './storage';

// Test with mock S3
const mockS3 = new MockS3Client();

// Test with temporary local storage
const adapter = new LocalStorageAdapter({
  type: 'local',
  baseUrl: 'http://test/static',
  localBasePath: '/tmp/test-storage',
});
```

## Troubleshooting

### Permission Denied Errors

Ensure volumes are owned by correct user:

```bash
docker-compose exec worker chown -R node:node /var/www/storage
```

### Nginx 404 Errors

Check volume mounts and file paths:

```bash
docker-compose exec nginx ls -la /var/www/storage/
```

### Storage Type Mismatch

Verify environment variables:

```bash
docker-compose exec worker env | grep STORAGE
```

## Migration

### From S3 to Local

```bash
# Download all files from S3
aws s3 sync s3://my-bucket/processed/ ./storage/processed/

# Copy to volume
docker cp ./storage/processed/ monorepo-worker:/var/www/storage/

# Update environment
export STORAGE_TYPE=local
docker-compose up -d
```

### From Local to S3

```bash
# Copy from volume
docker cp monorepo-worker:/var/www/storage/processed/ ./storage/

# Upload to S3
aws s3 sync ./storage/processed/ s3://my-bucket/processed/

# Update environment
export STORAGE_TYPE=s3
docker-compose up -d
```

## Best Practices

1. **Use local storage for development** - Faster, simpler setup
2. **Use S3 for production** - Scalable, distributed, durable
3. **Enable S3 versioning** - Protect against accidental deletion
4. **Monitor storage usage** - Set up alerts for disk space (local) or S3 costs
5. **Regular backups** - Automated daily backups of volumes
6. **CDN integration** - For production, use CloudFront or similar in front of S3
7. **Access control** - Implement signed URLs for private content
8. **Cleanup policy** - Remove old/unused files to save space

## Future Enhancements

- [ ] Support for Google Cloud Storage
- [ ] Support for Azure Blob Storage
- [ ] Automatic migration between storage backends
- [ ] Content delivery network (CloudFront, Cloudflare) integration
- [ ] Signed URL generation for private content
- [ ] Automatic cleanup of old files
- [ ] Storage usage analytics
- [ ] Multi-region replication
