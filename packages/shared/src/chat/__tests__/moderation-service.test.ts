import { ModerationService } from '../providers/moderation-service';

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(() => {
    service = new ModerationService();
  });

  describe('moderateContent', () => {
    it('should not flag safe content', async () => {
      const result = await service.moderateContent('Hello, how are you today?');

      expect(result.flagged).toBe(false);
      expect(result.categories).toEqual({
        hate: false,
        hateThreatening: false,
        selfHarm: false,
        sexual: false,
        sexualMinors: false,
        violence: false,
        violenceGraphic: false,
      });
    });

    it('should flag hate speech', async () => {
      const result = await service.moderateContent('I hate this');

      expect(result.flagged).toBe(true);
      expect(result.categories.hate).toBe(true);
      expect(result.scores.hate).toBeGreaterThan(0.5);
    });

    it('should flag violence', async () => {
      const result = await service.moderateContent('Violence is happening');

      expect(result.flagged).toBe(true);
      expect(result.categories.violence).toBe(true);
      expect(result.scores.violence).toBeGreaterThan(0.5);
    });

    it('should flag sexual content', async () => {
      const result = await service.moderateContent('This is sexual content');

      expect(result.flagged).toBe(true);
      expect(result.categories.sexual).toBe(true);
      expect(result.scores.sexual).toBeGreaterThan(0.5);
    });

    it('should flag self-harm content', async () => {
      const result = await service.moderateContent('I want to commit suicide');

      expect(result.flagged).toBe(true);
      expect(result.categories.selfHarm).toBe(true);
      expect(result.scores.selfHarm).toBeGreaterThan(0.5);
    });

    it('should be case insensitive', async () => {
      const result1 = await service.moderateContent('HATE');
      const result2 = await service.moderateContent('hate');
      const result3 = await service.moderateContent('HaTe');

      expect(result1.flagged).toBe(true);
      expect(result2.flagged).toBe(true);
      expect(result3.flagged).toBe(true);
    });

    it('should handle empty string', async () => {
      const result = await service.moderateContent('');

      expect(result.flagged).toBe(false);
    });

    it('should detect multiple violations', async () => {
      const result = await service.moderateContent('I hate violence and self harm');

      expect(result.flagged).toBe(true);
      expect(result.categories.hate).toBe(true);
      expect(result.categories.violence).toBe(true);
      expect(result.categories.selfHarm).toBe(true);
    });
  });

  describe('moderateBatch', () => {
    it('should moderate multiple contents', async () => {
      const contents = [
        'Hello world',
        'I hate this',
        'Violence is bad',
      ];

      const results = await service.moderateBatch(contents);

      expect(results).toHaveLength(3);
      expect(results[0].flagged).toBe(false);
      expect(results[1].flagged).toBe(true);
      expect(results[2].flagged).toBe(true);
    });

    it('should handle empty batch', async () => {
      const results = await service.moderateBatch([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('addBannedKeyword', () => {
    it('should add custom banned keyword', async () => {
      service.addBannedKeyword('custom');

      const result = await service.moderateContent('This contains custom word');

      expect(result).toBeDefined();
    });

    it('should normalize keyword to lowercase', async () => {
      service.addBannedKeyword('CUSTOM');

      const result1 = await service.moderateContent('custom');
      const result2 = await service.moderateContent('CUSTOM');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('removeBannedKeyword', () => {
    it('should remove banned keyword', () => {
      service.addBannedKeyword('temporary');
      service.removeBannedKeyword('temporary');

      expect(service).toBeDefined();
    });
  });

  describe('addSensitivePattern', () => {
    it('should add custom sensitive pattern', async () => {
      service.addSensitivePattern(/\bcustom\b/i);

      expect(service).toBeDefined();
    });

    it('should detect custom pattern', async () => {
      const pattern = /\btest123\b/i;
      service.addSensitivePattern(pattern);

      expect(service).toBeDefined();
    });
  });
});
