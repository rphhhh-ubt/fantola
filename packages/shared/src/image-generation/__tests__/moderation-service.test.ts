import { ModerationService } from '../providers/moderation-service';

describe('ModerationService', () => {
  let moderationService: ModerationService;

  beforeEach(() => {
    moderationService = new ModerationService();
  });

  describe('moderate', () => {
    it('should not flag clean prompts', () => {
      const result = moderationService.moderate('A beautiful sunset over mountains');

      expect(result.flagged).toBe(false);
      expect(result.categories.nudity).toBe(false);
      expect(result.categories.alcohol).toBe(false);
      expect(result.categories.logos).toBe(false);
      expect(result.categories.violence).toBe(false);
      expect(result.flaggedTerms).toHaveLength(0);
    });

    it('should flag prompts with nudity keywords', () => {
      const result = moderationService.moderate('A nude portrait painting');

      expect(result.flagged).toBe(true);
      expect(result.categories.nudity).toBe(true);
      expect(result.flaggedTerms).toContain('nude');
    });

    it('should flag prompts with alcohol keywords', () => {
      const result = moderationService.moderate('People drinking beer at a bar');

      expect(result.flagged).toBe(true);
      expect(result.categories.alcohol).toBe(true);
      expect(result.flaggedTerms).toContain('drinking');
      expect(result.flaggedTerms).toContain('beer');
      expect(result.flaggedTerms).toContain('bar');
    });

    it('should flag prompts with logo keywords', () => {
      const result = moderationService.moderate('Nike swoosh logo');

      expect(result.flagged).toBe(true);
      expect(result.categories.logos).toBe(true);
      expect(result.flaggedTerms).toContain('nike');
      expect(result.flaggedTerms).toContain('logo');
    });

    it('should flag prompts with violence keywords', () => {
      const result = moderationService.moderate('A violent battle scene with weapons');

      expect(result.flagged).toBe(true);
      expect(result.categories.violence).toBe(true);
      expect(result.flaggedTerms).toContain('violent');
      expect(result.flaggedTerms).toContain('weapon');
    });

    it('should flag prompts with multiple categories', () => {
      const result = moderationService.moderate('Nude person drinking vodka with violence');

      expect(result.flagged).toBe(true);
      expect(result.categories.nudity).toBe(true);
      expect(result.categories.alcohol).toBe(true);
      expect(result.categories.violence).toBe(true);
      expect(result.flaggedTerms?.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const result = moderationService.moderate('NUDE NAKED EXPLICIT');

      expect(result.flagged).toBe(true);
      expect(result.categories.nudity).toBe(true);
    });

    it('should calculate scores for each category', () => {
      const result = moderationService.moderate('nudity explicit');

      expect(result.scores).toBeDefined();
      expect(result.scores!.nudity).toBeGreaterThan(0);
      expect(result.scores!.alcohol).toBe(0);
    });

    it('should remove duplicate flagged terms', () => {
      const result = moderationService.moderate('nude nude nude');

      expect(result.flagged).toBe(true);
      expect(result.flaggedTerms).toHaveLength(1);
      expect(result.flaggedTerms).toContain('nude');
    });
  });

  describe('addKeywords', () => {
    it('should allow adding custom nudity keywords', () => {
      moderationService.addKeywords('nudity', ['custom-nsfw']);

      const result = moderationService.moderate('custom-nsfw content');

      expect(result.flagged).toBe(true);
      expect(result.categories.nudity).toBe(true);
      expect(result.flaggedTerms).toContain('custom-nsfw');
    });

    it('should allow adding custom alcohol keywords', () => {
      moderationService.addKeywords('alcohol', ['mojito']);

      const result = moderationService.moderate('drinking a mojito');

      expect(result.flagged).toBe(true);
      expect(result.categories.alcohol).toBe(true);
    });

    it('should allow adding custom logo keywords', () => {
      moderationService.addKeywords('logos', ['acme-corp']);

      const result = moderationService.moderate('acme-corp logo');

      expect(result.flagged).toBe(true);
      expect(result.categories.logos).toBe(true);
    });

    it('should allow adding custom violence keywords', () => {
      moderationService.addKeywords('violence', ['explosion']);

      const result = moderationService.moderate('massive explosion');

      expect(result.flagged).toBe(true);
      expect(result.categories.violence).toBe(true);
    });
  });
});
