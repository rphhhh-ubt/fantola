# Worker Service

The worker service is responsible for processing background jobs, including image post-processing and transformations.

## Features

### Image Post-Processing Pipeline

The worker service includes a comprehensive image post-processing pipeline that:

- Generates multiple quality variants (normal and high-quality) of processed images
- Uses [sharp](https://sharp.pixelplumbing.com/) for high-performance image resizing and compression
- Supports multiple image generation tools (DALL-E, Sora, Stable Diffusion)
- Integrates with S3 for storage
- Tracks detailed processing metrics using Prometheus
- Provides configurable quality presets per tool

#### Quality Variants

Each processed image generates two variants:

1. **Normal Quality**: Optimized for fast loading and general use
   - Lower resolution
   - JPEG format for better compression
   - Quality: 80-85%
   - Smaller file sizes

2. **High Quality**: Optimized for detailed viewing and archival
   - Higher resolution
   - WebP format for better quality-to-size ratio
   - Quality: 95%
   - Larger file sizes but better visual quality

#### Supported Tools

##### DALL-E
- Normal: 1024x1024, JPEG, 80% quality
- High-Quality: 2048x2048, WebP, 95% quality

##### Sora
- Normal: 1280x720, JPEG, 85% quality
- High-Quality: 1920x1080, WebP, 95% quality

##### Stable Diffusion
- Normal: 768x768, JPEG, 80% quality
- High-Quality: 1536x1536, WebP, 95% quality

## Architecture

```
src/
├── config/
│   └── quality-presets.ts    # Quality configurations per tool
├── processors/
│   └── image-processor.ts    # Main image processing logic
├── types.ts                   # TypeScript type definitions
└── index.ts                   # Service entry point
```

## Usage

### Processing an Image

```typescript
import { ImageProcessor } from './processors/image-processor';
import { ImageTool, ImageProcessingJob } from './types';

const processor = new ImageProcessor(storageConfig, monitoring);

const job: ImageProcessingJob = {
  id: 'job-123',
  tool: ImageTool.DALL_E,
  sourceUrl: 'https://example.com/original.jpg',
  userId: 'user-123',
  metadata: {
    prompt: 'A beautiful landscape',
  },
};

const result = await processor.processImage(job);

if (result.success) {
  console.log('Processing time:', result.processingTimeMs);
  console.log('Variants:', result.variants);
  // Access URLs: result.variants[0].url, result.variants[1].url
}
```

### Loading Source Images

The processor supports three methods of loading source images:

1. **From Buffer**: Provide `sourceBuffer` directly
2. **From S3**: Provide `sourcePath` with format `s3://bucket/key`
3. **From URL**: Provide `sourceUrl` with HTTP(S) URL

### Configuration

Set the following environment variables:

```bash
# S3 Storage Configuration
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000  # Optional, for MinIO or custom endpoints
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9091
LOG_LEVEL=info
```

## Metrics

The image processor tracks the following metrics:

### Processing Metrics

- `image_processing_duration_seconds`: Time taken to process an image (histogram)
  - Labels: `tool`, `success`

- `image_compression_ratio`: Ratio of original to compressed size (histogram)
  - Labels: `tool`

- `image_original_size_bytes`: Size of original image in bytes (histogram)
  - Labels: `tool`

- `image_compressed_size_bytes`: Size of compressed image in bytes (histogram)
  - Labels: `tool`, `variant`

### KPI Tracking

- `generation_success`: Successful image processing
- `generation_failure`: Failed image processing

## Error Handling

The processor handles errors gracefully and tracks failures:

- Network errors when fetching source images
- Invalid image formats
- S3 upload failures
- Memory constraints
- Sharp processing errors

All errors are logged with context and tracked in monitoring metrics.

## Testing

Run tests with:

```bash
pnpm test                 # Run all tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage report
```

Test coverage includes:

- ✅ Image processing with multiple variants
- ✅ Quality preset validation for all tools
- ✅ Compression and file size reduction
- ✅ Storage upload and URL generation
- ✅ Metrics tracking
- ✅ Error handling and recovery
- ✅ Source loading from Buffer, S3, and URL
- ✅ Aspect ratio preservation
- ✅ Resolution constraints

## Development

Build and run the service:

```bash
pnpm build               # Compile TypeScript
pnpm dev                 # Run in development mode
pnpm start               # Run compiled version
pnpm typecheck          # Type checking
pnpm lint               # Lint code
```

## Dependencies

- `sharp`: High-performance image processing
- `@aws-sdk/client-s3`: S3 storage integration
- `@monorepo/monitoring`: Metrics and logging
- `@monorepo/config`: Configuration management
- `@monorepo/shared`: Shared utilities

## Performance Considerations

- Images are processed in-memory using sharp's efficient pipeline
- Parallel processing of normal and high-quality variants (sequential in current implementation, but can be parallelized)
- Automatic garbage collection of processed buffers
- Configurable quality presets to balance quality vs. file size
- WebP format for high-quality variants provides better compression than PNG

## Future Enhancements

- [ ] Add support for batch processing
- [ ] Implement parallel variant generation
- [ ] Add video thumbnail extraction
- [ ] Support for animated formats (GIF, WebP animation)
- [ ] Add watermarking capabilities
- [ ] Implement progressive image loading
- [ ] Add image format detection and conversion
- [ ] Implement smart cropping based on content
