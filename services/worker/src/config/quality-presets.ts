import { ImageTool, ImageQualityVariant, QualityPreset } from '../types';

export type QualityPresetsConfig = {
  [key in ImageTool]: {
    [variant in ImageQualityVariant]: QualityPreset;
  };
};

export const QUALITY_PRESETS: QualityPresetsConfig = {
  [ImageTool.DALL_E]: {
    [ImageQualityVariant.NORMAL]: {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 80,
      format: 'jpeg',
      compressionLevel: 6,
    },
    [ImageQualityVariant.HIGH_QUALITY]: {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 95,
      format: 'webp',
      compressionLevel: 4,
    },
  },
  [ImageTool.SORA]: {
    [ImageQualityVariant.NORMAL]: {
      maxWidth: 1280,
      maxHeight: 720,
      quality: 85,
      format: 'jpeg',
      compressionLevel: 6,
    },
    [ImageQualityVariant.HIGH_QUALITY]: {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 95,
      format: 'webp',
      compressionLevel: 4,
    },
  },
  [ImageTool.STABLE_DIFFUSION]: {
    [ImageQualityVariant.NORMAL]: {
      maxWidth: 768,
      maxHeight: 768,
      quality: 80,
      format: 'jpeg',
      compressionLevel: 6,
    },
    [ImageQualityVariant.HIGH_QUALITY]: {
      maxWidth: 1536,
      maxHeight: 1536,
      quality: 95,
      format: 'webp',
      compressionLevel: 4,
    },
  },
};

export function getQualityPreset(tool: ImageTool, variant: ImageQualityVariant): QualityPreset {
  return QUALITY_PRESETS[tool][variant];
}

export function getAllVariants(tool: ImageTool): QualityPreset[] {
  return [
    QUALITY_PRESETS[tool][ImageQualityVariant.NORMAL],
    QUALITY_PRESETS[tool][ImageQualityVariant.HIGH_QUALITY],
  ];
}
