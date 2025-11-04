export enum ImageQualityVariant {
  NORMAL = 'normal',
  HIGH_QUALITY = 'high-quality',
}

export enum ImageTool {
  DALL_E = 'dall-e',
  SORA = 'sora',
  STABLE_DIFFUSION = 'stable-diffusion',
}

export interface QualityPreset {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
  compressionLevel?: number;
}

export interface ProcessingResult {
  variant: ImageQualityVariant;
  url: string;
  size: number;
  width: number;
  height: number;
  format: string;
}

export interface ImageProcessingJob {
  id: string;
  tool: ImageTool;
  sourceUrl?: string;
  sourcePath?: string;
  sourceBuffer?: Buffer;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface ImageProcessingResult {
  jobId: string;
  success: boolean;
  variants: ProcessingResult[];
  originalSize: number;
  processingTimeMs: number;
  error?: string;
}

export interface ProcessingMetrics {
  processingTimeMs: number;
  originalSize: number;
  compressedSizes: Record<ImageQualityVariant, number>;
  compressionRatio: number;
  success: boolean;
  tool: ImageTool;
  error?: string;
}
