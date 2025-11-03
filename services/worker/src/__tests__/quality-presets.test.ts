import {
  QUALITY_PRESETS,
  getQualityPreset,
  getAllVariants,
} from '../config/quality-presets';
import { ImageTool, ImageQualityVariant } from '../types';

describe('Quality Presets', () => {
  describe('QUALITY_PRESETS', () => {
    it('should have presets for all image tools', () => {
      expect(QUALITY_PRESETS[ImageTool.DALL_E]).toBeDefined();
      expect(QUALITY_PRESETS[ImageTool.SORA]).toBeDefined();
      expect(QUALITY_PRESETS[ImageTool.STABLE_DIFFUSION]).toBeDefined();
    });

    it('should have both normal and high-quality variants for each tool', () => {
      Object.values(ImageTool).forEach((tool) => {
        expect(QUALITY_PRESETS[tool][ImageQualityVariant.NORMAL]).toBeDefined();
        expect(QUALITY_PRESETS[tool][ImageQualityVariant.HIGH_QUALITY]).toBeDefined();
      });
    });

    it('should have valid preset properties for DALL_E', () => {
      const normalPreset = QUALITY_PRESETS[ImageTool.DALL_E][ImageQualityVariant.NORMAL];
      const hqPreset = QUALITY_PRESETS[ImageTool.DALL_E][ImageQualityVariant.HIGH_QUALITY];

      expect(normalPreset.maxWidth).toBe(1024);
      expect(normalPreset.maxHeight).toBe(1024);
      expect(normalPreset.quality).toBe(80);
      expect(normalPreset.format).toBe('jpeg');

      expect(hqPreset.maxWidth).toBe(2048);
      expect(hqPreset.maxHeight).toBe(2048);
      expect(hqPreset.quality).toBe(95);
      expect(hqPreset.format).toBe('webp');
    });

    it('should have valid preset properties for SORA', () => {
      const normalPreset = QUALITY_PRESETS[ImageTool.SORA][ImageQualityVariant.NORMAL];
      const hqPreset = QUALITY_PRESETS[ImageTool.SORA][ImageQualityVariant.HIGH_QUALITY];

      expect(normalPreset.maxWidth).toBe(1280);
      expect(normalPreset.maxHeight).toBe(720);
      expect(normalPreset.quality).toBe(85);
      expect(normalPreset.format).toBe('jpeg');

      expect(hqPreset.maxWidth).toBe(1920);
      expect(hqPreset.maxHeight).toBe(1080);
      expect(hqPreset.quality).toBe(95);
      expect(hqPreset.format).toBe('webp');
    });

    it('should have valid preset properties for STABLE_DIFFUSION', () => {
      const normalPreset =
        QUALITY_PRESETS[ImageTool.STABLE_DIFFUSION][ImageQualityVariant.NORMAL];
      const hqPreset =
        QUALITY_PRESETS[ImageTool.STABLE_DIFFUSION][ImageQualityVariant.HIGH_QUALITY];

      expect(normalPreset.maxWidth).toBe(768);
      expect(normalPreset.maxHeight).toBe(768);
      expect(normalPreset.quality).toBe(80);
      expect(normalPreset.format).toBe('jpeg');

      expect(hqPreset.maxWidth).toBe(1536);
      expect(hqPreset.maxHeight).toBe(1536);
      expect(hqPreset.quality).toBe(95);
      expect(hqPreset.format).toBe('webp');
    });

    it('should have higher quality settings for high-quality variants', () => {
      Object.values(ImageTool).forEach((tool) => {
        const normalPreset = QUALITY_PRESETS[tool][ImageQualityVariant.NORMAL];
        const hqPreset = QUALITY_PRESETS[tool][ImageQualityVariant.HIGH_QUALITY];

        expect(hqPreset.quality).toBeGreaterThanOrEqual(normalPreset.quality);
        expect(hqPreset.maxWidth).toBeGreaterThanOrEqual(normalPreset.maxWidth);
        expect(hqPreset.maxHeight).toBeGreaterThanOrEqual(normalPreset.maxHeight);
      });
    });

    it('should have compression level for all presets', () => {
      Object.values(ImageTool).forEach((tool) => {
        Object.values(ImageQualityVariant).forEach((variant) => {
          const preset = QUALITY_PRESETS[tool][variant];
          expect(preset.compressionLevel).toBeDefined();
          expect(preset.compressionLevel).toBeGreaterThan(0);
        });
      });
    });

    it('should use appropriate formats', () => {
      Object.values(ImageTool).forEach((tool) => {
        Object.values(ImageQualityVariant).forEach((variant) => {
          const preset = QUALITY_PRESETS[tool][variant];
          expect(['jpeg', 'webp', 'png']).toContain(preset.format);
        });
      });
    });
  });

  describe('getQualityPreset', () => {
    it('should return correct preset for DALL_E normal variant', () => {
      const preset = getQualityPreset(ImageTool.DALL_E, ImageQualityVariant.NORMAL);

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(1024);
      expect(preset.maxHeight).toBe(1024);
      expect(preset.quality).toBe(80);
      expect(preset.format).toBe('jpeg');
    });

    it('should return correct preset for DALL_E high-quality variant', () => {
      const preset = getQualityPreset(ImageTool.DALL_E, ImageQualityVariant.HIGH_QUALITY);

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(2048);
      expect(preset.maxHeight).toBe(2048);
      expect(preset.quality).toBe(95);
      expect(preset.format).toBe('webp');
    });

    it('should return correct preset for SORA normal variant', () => {
      const preset = getQualityPreset(ImageTool.SORA, ImageQualityVariant.NORMAL);

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(1280);
      expect(preset.maxHeight).toBe(720);
    });

    it('should return correct preset for SORA high-quality variant', () => {
      const preset = getQualityPreset(ImageTool.SORA, ImageQualityVariant.HIGH_QUALITY);

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(1920);
      expect(preset.maxHeight).toBe(1080);
    });

    it('should return correct preset for STABLE_DIFFUSION normal variant', () => {
      const preset = getQualityPreset(ImageTool.STABLE_DIFFUSION, ImageQualityVariant.NORMAL);

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(768);
      expect(preset.maxHeight).toBe(768);
    });

    it('should return correct preset for STABLE_DIFFUSION high-quality variant', () => {
      const preset = getQualityPreset(
        ImageTool.STABLE_DIFFUSION,
        ImageQualityVariant.HIGH_QUALITY
      );

      expect(preset).toBeDefined();
      expect(preset.maxWidth).toBe(1536);
      expect(preset.maxHeight).toBe(1536);
    });
  });

  describe('getAllVariants', () => {
    it('should return all variants for DALL_E', () => {
      const variants = getAllVariants(ImageTool.DALL_E);

      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual(QUALITY_PRESETS[ImageTool.DALL_E][ImageQualityVariant.NORMAL]);
      expect(variants[1]).toEqual(
        QUALITY_PRESETS[ImageTool.DALL_E][ImageQualityVariant.HIGH_QUALITY]
      );
    });

    it('should return all variants for SORA', () => {
      const variants = getAllVariants(ImageTool.SORA);

      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual(QUALITY_PRESETS[ImageTool.SORA][ImageQualityVariant.NORMAL]);
      expect(variants[1]).toEqual(
        QUALITY_PRESETS[ImageTool.SORA][ImageQualityVariant.HIGH_QUALITY]
      );
    });

    it('should return all variants for STABLE_DIFFUSION', () => {
      const variants = getAllVariants(ImageTool.STABLE_DIFFUSION);

      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual(
        QUALITY_PRESETS[ImageTool.STABLE_DIFFUSION][ImageQualityVariant.NORMAL]
      );
      expect(variants[1]).toEqual(
        QUALITY_PRESETS[ImageTool.STABLE_DIFFUSION][ImageQualityVariant.HIGH_QUALITY]
      );
    });

    it('should return different presets for normal and high-quality', () => {
      Object.values(ImageTool).forEach((tool) => {
        const variants = getAllVariants(tool);
        expect(variants[0]).not.toEqual(variants[1]);
      });
    });
  });
});
