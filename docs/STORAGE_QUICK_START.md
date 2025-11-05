# Storage Integration - Quick Start

Quick reference guide for storage integration setup and usage.

## 🚀 Quick Setup

### Development (Local Storage)

```bash
# 1. Set environment variables
export STORAGE_TYPE=local
export STORAGE_BASE_URL=http://localhost/static
export STORAGE_LOCAL_PATH=/var/www/storage

# 2. Start services with Nginx CDN
make docker-up-nginx

# 3. Access static files at:
# http://localhost/static/uploads/
# http://localhost/static/generated/
# http://localhost/static/processed/
```

### Production (S3 Storage)

```bash
# 1. Set environment variables
export STORAGE_TYPE=s3
export S3_BUCKET=my-bucket
export S3_REGION=us-east-1
export S3_ACCESS_KEY_ID=xxx
export S3_SECRET_ACCESS_KEY=yyy

# 2. Start services
make docker-up
```

## 📁 Directory Structure

```
/var/www/storage/
├── uploads/          # User-uploaded files
├── generated/        # AI-generated content
└── processed/        # Post-processed images
    ├── dall-e/
    ├── sora/
    └── stable-diffusion/
```

## 🔧 Common Commands

```bash
# Initialize storage volumes
make storage-init

# Backup storage
make storage-backup

# Restore storage
make storage-restore FILE=backups/storage/storage-20240101.tar.gz

# Clean storage (destructive!)
make storage-clean

# View storage usage
docker system df -v
```

## 🌐 Nginx URLs

- **Uploads**: `http://localhost/static/uploads/`
- **Generated**: `http://localhost/static/generated/`
- **Processed**: `http://localhost/static/processed/`

## 💻 Usage in Code

### Worker Service

```typescript
import { StorageConfig, StorageFactory } from './storage';

// Local storage
const storage = StorageFactory.createAdapter({
  type: 'local',
  baseUrl: 'http://localhost/static',
  localBasePath: '/var/www/storage',
});

// S3 storage
const storage = StorageFactory.createAdapter({
  type: 's3',
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
  },
});

// Upload file
const url = await storage.upload('path/to/file.jpg', buffer, 'image/jpeg');

// Download file
const buffer = await storage.download('path/to/file.jpg');
```

### Image Processor

```typescript
import { ImageProcessor } from './processors/image-processor';

const processor = new ImageProcessor(storageConfig, monitoring);

const result = await processor.processImage({
  id: 'job-123',
  tool: ImageTool.DALL_E,
  sourceUrl: 'https://example.com/image.jpg',
  userId: 'user-123',
});

console.log('Normal:', result.variants[0].url);
console.log('HQ:', result.variants[1].url);
```

## 🔍 Troubleshooting

### Permission Denied

```bash
docker-compose exec worker chown -R node:node /var/www/storage
docker-compose exec worker chmod -R 755 /var/www/storage
```

### Files Not Accessible via Nginx

```bash
# Check nginx container
docker-compose exec nginx ls -la /var/www/storage/

# Check volume mounts
docker-compose config | grep -A 10 volumes
```

### Storage Type Not Set

```bash
# Check environment
docker-compose exec worker env | grep STORAGE

# Set in .env file
echo "STORAGE_TYPE=local" >> .env
```

## 📊 Cache Configuration

| Path                 | Cache Duration | Purpose          |
| -------------------- | -------------- | ---------------- |
| `/static/uploads/`   | 7 days         | User content     |
| `/static/generated/` | 30 days        | AI-generated     |
| `/static/processed/` | 30 days        | Processed images |

All paths include:

- Gzip compression
- CORS headers
- Immutable cache-control
- Security headers

## 🔄 Migration

### Local → S3

```bash
make storage-backup
aws s3 sync ./backups/storage/extracted/ s3://my-bucket/
export STORAGE_TYPE=s3
docker-compose up -d
```

### S3 → Local

```bash
aws s3 sync s3://my-bucket/ ./storage/
docker cp ./storage/ monorepo-worker:/var/www/storage/
export STORAGE_TYPE=local
docker-compose up -d
```

## 📚 Documentation

- [Full Storage Integration Guide](./STORAGE_INTEGRATION.md)
- [Worker Storage Documentation](../services/worker/STORAGE.md)
- [Image Post-Processing](./IMAGE_POST_PROCESSING.md)

## 🔗 Related

- Monitoring: [docs/MONITORING.md](./MONITORING.md)
- Rate Limiting: [docs/RATE_LIMITING_AND_TOKEN_BILLING.md](./RATE_LIMITING_AND_TOKEN_BILLING.md)
- Deployment: [DEPLOYMENT_SUMMARY.md](../DEPLOYMENT_SUMMARY.md)
