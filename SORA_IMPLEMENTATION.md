# Sora Multi-Image Workflow Implementation

## Overview
This implementation adds support for Sora video generation from multiple input images with content moderation, temporary storage, and multi-resolution output generation.

## Database Changes

### New Enums
- `ModerationStatus`: `pending`, `approved`, `rejected`

### New Models

#### SoraGeneration
Tracks Sora video generation jobs with multi-image support.

**Fields:**
- `id` (UUID): Primary key
- `userId` (UUID): Foreign key to User
- `prompt` (Text): Generation prompt
- `status` (GenerationStatus): pending, processing, completed, failed, canceled
- `moderationStatus` (ModerationStatus): Content moderation status
- `moderationReason` (Text?): Reason for moderation rejection
- `moderatedAt` (DateTime?): When moderation was completed
- `resultUrls` (String[]): Multi-resolution output URLs
- `errorMessage` (Text?): Error message if failed
- `tokensUsed` (Int): Tokens charged for this generation
- `startedAt` (DateTime?): When processing started
- `completedAt` (DateTime?): When processing completed
- `retryCount` (Int): Number of retry attempts
- `lastRetryAt` (DateTime?): Last retry timestamp
- `metadata` (Json?): Additional metadata

**Relations:**
- `user`: User who created the generation
- `images`: SoraImage[] - Input images

**Indexes:**
- `userId`, `status`, `moderationStatus`, `createdAt`

#### SoraImage
Stores individual images for Sora generation with temporary storage.

**Fields:**
- `id` (UUID): Primary key
- `generationId` (UUID): Foreign key to SoraGeneration
- `storageKey` (String): Storage location key
- `storageUrl` (Text): Public URL to access image
- `size` (Int): File size in bytes
- `width` (Int?): Image width
- `height` (Int?): Image height
- `mimeType` (String): MIME type (image/jpeg, image/png, image/webp)
- `moderationStatus` (ModerationStatus): Individual image moderation status
- `moderationReason` (Text?): Rejection reason
- `moderatedAt` (DateTime?): Moderation timestamp
- `expiresAt` (DateTime): Expiry for temporary storage (24 hours)
- `metadata` (Json?): Additional metadata

**Relations:**
- `generation`: SoraGeneration - Parent generation

**Indexes:**
- `generationId`, `storageKey`, `moderationStatus`, `expiresAt`

## API Endpoints

### POST /api/v1/sora/upload
Upload images and prompt for Sora video generation.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "prompt": "string (1-5000 chars)",
  "images": [
    {
      "data": "base64 encoded image",
      "mimeType": "image/jpeg|image/png|image/webp"
    }
  ]
}
```

**Constraints:**
- 1-4 images required
- Max 10MB per image
- Supported formats: JPEG, PNG, WebP

**Response (201):**
```json
{
  "id": "uuid",
  "status": "pending",
  "moderationStatus": "approved",
  "message": "Generation queued successfully"
}
```

**Error Responses:**
- 400: Invalid input (no images, too many images, invalid prompt)
- 401: Unauthorized
- 402: Insufficient tokens

**Process:**
1. Validates authentication
2. Checks token balance
3. Validates images (count, size, format)
4. Creates generation record
5. Uploads images to temporary storage
6. Runs content moderation
7. Queues generation job if approved
8. Deducts tokens (10 tokens per sora_image operation)

### GET /api/v1/sora/generation/:id
Get Sora generation status and results.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "id": "uuid",
  "status": "pending|processing|completed|failed",
  "moderationStatus": "pending|approved|rejected",
  "prompt": "string",
  "resultUrls": ["url1", "url2", "url3"],
  "errorMessage": "string|null",
  "tokensUsed": 10,
  "retryCount": 0,
  "createdAt": "ISO date",
  "startedAt": "ISO date|null",
  "completedAt": "ISO date|null",
  "images": [
    {
      "id": "uuid",
      "storageUrl": "url",
      "size": 1024,
      "width": 1920,
      "height": 1080,
      "mimeType": "image/jpeg",
      "moderationStatus": "approved"
    }
  ]
}
```

**Error Responses:**
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Not found

### POST /api/v1/sora/generation/:id/retry
Retry a failed Sora generation.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "id": "uuid",
  "status": "pending",
  "message": "Generation retry queued successfully"
}
```

**Error Responses:**
- 400: Only failed generations can be retried
- 401: Unauthorized
- 403: Forbidden (not owner)
- 404: Not found

## Services

### SoraService
Main service for Sora generation management.

**Methods:**
- `createGeneration(input)`: Creates a new generation record
- `storeImages(generationId, images, storageUrls)`: Stores image references
- `moderateGeneration(generationId)`: Runs content moderation
- `getGeneration(generationId)`: Retrieves generation with images
- `updateGenerationStatus(generationId, status, data)`: Updates generation
- `retryGeneration(generationId)`: Retries a failed generation

**Validation:**
- Prompt: 1-5000 characters
- Images: 1-4 images
- Image size: Max 10MB per image
- MIME types: image/jpeg, image/png, image/webp

### StorageService
Handles temporary image storage.

**Methods:**
- `uploadImage(buffer, mimeType, userId)`: Uploads image to temp storage
- `downloadImage(storageKey)`: Downloads image from storage
- `deleteImage(storageKey)`: Deletes image from storage
- `getImageMetadata(buffer)`: Extracts image dimensions using sharp
- `cleanupExpiredImages()`: Removes expired temp images

**Storage:**
- In-memory storage for testing
- Production: S3 or similar object storage
- Expiry: 24 hours from creation

### QueueService
Manages job queueing using BullMQ.

**Queue:** `sora-generation`

**Job Data:**
```typescript
{
  generationId: string;
  userId: string;
  prompt: string;
  imageUrls: string[];
  timestamp: number;
}
```

**Configuration:**
- Max 3 retry attempts
- Exponential backoff (5s delay)
- Auto-cleanup completed jobs (keep 100, age 1h)

## Worker Processing

### SoraProcessor
Processes Sora generation jobs.

**Process:**
1. Updates status to "processing"
2. Downloads input images from temporary storage
3. Generates multi-resolution outputs:
   - 1080p (1920x1080)
   - 720p (1280x720)
   - 480p (854x480)
4. Uploads processed outputs to permanent storage
5. Updates generation with result URLs and status "completed"
6. Tracks metrics (success/failure)

**Error Handling:**
- Updates status to "failed" with error message
- Supports retry via API endpoint
- Tracks retry count

**Storage:**
- Input images: `temp/sora/{userId}/{uuid}.jpg`
- Output videos: `sora/{userId}/{generationId}/{resolution}.jpg`

## Queue Configuration

**New Queue:** `SORA_GENERATION = 'sora-generation'`

Added to `@monorepo/shared/src/queue/types.ts`:
- `QueueName.SORA_GENERATION`
- `SoraGenerationJobData` interface

## Testing

### API Tests (`services/api/src/__tests__/sora.test.ts`)

**Happy Path:**
- Successfully upload images and create generation
- Retrieve generation details
- Retry failed generation

**Validation Tests:**
- Reject when no images provided
- Reject when > 4 images provided
- Reject when prompt is missing
- Reject when user has insufficient tokens

**Moderation Tests:**
- Moderation failure scenario (simulated)

### Worker Tests (`services/worker/src/__tests__/sora-processor.test.ts`)

**Happy Path:**
- Successfully process generation job
- Generate multi-resolution outputs
- Update database with results

**Error Handling:**
- Handle processing failure
- Update database with error

**Retry Scenarios:**
- Process retry after failure
- Track retry count

### Service Tests (`services/api/src/__tests__/sora-service.test.ts`)

**Validation Tests:**
- Reject empty prompt
- Reject no images
- Reject > 4 images
- Reject invalid image types
- Reject oversized images

**Moderation Tests:**
- Approve valid generation
- Track moderation status

**Retry Tests:**
- Retry failed generation
- Reject retry of non-failed generation

## Configuration

### API Service
Added to `@monorepo/config`:
- Storage configuration in `apiConfigSchema`

### Environment Variables
```bash
# Storage Configuration
STORAGE_TYPE=local  # or s3
STORAGE_BASE_URL=http://localhost/static
STORAGE_LOCAL_PATH=/var/www/storage

# S3 Configuration (when STORAGE_TYPE=s3)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=dev-bucket
S3_ACCESS_KEY_ID=dev_access_key
S3_SECRET_ACCESS_KEY=dev_secret_key
```

## Dependencies Added

### API Service
- `sharp`: Image processing
- `uuid`: UUID generation
- `axios`: HTTP client
- `bullmq`: Queue management
- `@types/uuid`: TypeScript types

### Worker Service
Already has `sharp`, `axios`, `bullmq`

## Token Billing

**Operation Type:** `sora_image`
**Cost:** 10 tokens
**Charged:** After successful moderation, before queueing

## Content Moderation

**Current Implementation:** Auto-approve (placeholder)

**Production Integration Points:**
- AWS Rekognition
- Google Cloud Vision API
- Azure Content Moderator
- Sightengine
- Hive Moderation

**Moderation Checks:**
- Per-image moderation
- Generation-level moderation (all images must pass)
- Rejection tracking with reason

## Multi-Resolution Outputs

**Resolutions:**
1. 1080p (1920x1080) - High quality
2. 720p (1280x720) - Medium quality
3. 480p (854x480) - Low quality

**Format:** JPEG
**Quality:** 90 (mozjpeg compression)
**Fit:** Cover (crop to fit)

## Security

**Authentication:**
- All endpoints require Bearer token
- JWT validation via Fastify auth plugin

**Authorization:**
- Users can only access their own generations
- User ID extracted from JWT payload

**Validation:**
- Input sanitization
- File size limits
- MIME type validation
- Image count validation

## Monitoring

**Metrics Tracked:**
- Generation success/failure
- Processing time
- Image count per generation
- Retry attempts

**Logging:**
- Generation created
- Images stored
- Moderation completed
- Job queued
- Processing started/completed
- Errors with context

## Future Enhancements

1. **Real Content Moderation:** Integrate with external moderation service
2. **S3 Storage:** Implement production-ready object storage
3. **Video Generation:** Replace image processing with actual video generation API
4. **Webhook Notifications:** Notify users when generation completes
5. **Progress Updates:** WebSocket or polling for real-time status
6. **Batch Processing:** Support multiple generations in one request
7. **Image Cleanup:** Automated cleanup of expired temporary images
8. **Advanced Retry Logic:** Exponential backoff with max retry limits
9. **Rate Limiting:** Per-user rate limits for generation requests
10. **Analytics:** Usage statistics and generation metrics dashboard
