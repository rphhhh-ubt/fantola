import type { ModerationResult } from '../types';

/**
 * Content moderation service for filtering inappropriate content
 */
export class ModerationService {
  private readonly bannedKeywords: Set<string>;
  private readonly sensitivePatterns: RegExp[];

  constructor() {
    // Initialize with basic banned keywords
    // In production, this should be loaded from a database or config
    this.bannedKeywords = new Set([
      'explicit',
      'illegal',
      'harmful',
      // Add more keywords as needed
    ]);

    // Common patterns to detect
    this.sensitivePatterns = [
      /\b(violence|violent)\b/i,
      /\b(hate|hatred)\b/i,
      /\b(sexual|sex)\b/i,
      /\b(harm|hurt)\b/i,
    ];
  }

  /**
   * Check if content violates moderation policies
   */
  async moderateContent(content: string): Promise<ModerationResult> {
    const normalizedContent = content.toLowerCase();

    const categories = {
      hate: this.checkHate(normalizedContent),
      hateThreatening: false,
      selfHarm: this.checkSelfHarm(normalizedContent),
      sexual: this.checkSexual(normalizedContent),
      sexualMinors: false,
      violence: this.checkViolence(normalizedContent),
      violenceGraphic: false,
    };

    const scores: Record<string, number> = {
      hate: categories.hate ? 0.8 : 0.1,
      selfHarm: categories.selfHarm ? 0.8 : 0.1,
      sexual: categories.sexual ? 0.8 : 0.1,
      violence: categories.violence ? 0.8 : 0.1,
    };

    const flagged = Object.values(categories).some((value) => value === true);

    return {
      flagged,
      categories,
      scores,
    };
  }

  /**
   * Batch moderation for multiple messages
   */
  async moderateBatch(contents: string[]): Promise<ModerationResult[]> {
    return Promise.all(contents.map((content) => this.moderateContent(content)));
  }

  private checkHate(content: string): boolean {
    const hatePatterns = [/\bhate\b/i, /\bhatred\b/i, /\brabcist\b/i];
    return hatePatterns.some((pattern) => pattern.test(content));
  }

  private checkSelfHarm(content: string): boolean {
    const selfHarmPatterns = [/\bsuicide\b/i, /\bself[\s-]harm\b/i, /\bkill[\s]+myself\b/i];
    return selfHarmPatterns.some((pattern) => pattern.test(content));
  }

  private checkSexual(content: string): boolean {
    const sexualPatterns = [/\bsexual\b/i, /\bexplicit\b/i, /\bporn\b/i];
    return sexualPatterns.some((pattern) => pattern.test(content));
  }

  private checkViolence(content: string): boolean {
    const violencePatterns = [/\bviolence\b/i, /\bviolent\b/i, /\battack\b/i, /\bkill\b/i];
    return violencePatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Add custom banned keyword
   */
  addBannedKeyword(keyword: string): void {
    this.bannedKeywords.add(keyword.toLowerCase());
  }

  /**
   * Remove banned keyword
   */
  removeBannedKeyword(keyword: string): void {
    this.bannedKeywords.delete(keyword.toLowerCase());
  }

  /**
   * Add custom sensitive pattern
   */
  addSensitivePattern(pattern: RegExp): void {
    this.sensitivePatterns.push(pattern);
  }
}
