import type { ModerationResult } from '../types';

/**
 * Content moderation service for image generation prompts
 * Checks for inappropriate content before dispatching to providers
 */
export class ModerationService {
  private readonly nudityKeywords = [
    'nude',
    'naked',
    'nudity',
    'nsfw',
    'xxx',
    'porn',
    'sex',
    'sexual',
    'erotic',
    'explicit',
    'topless',
    'underwear',
    'lingerie',
    'bikini',
    'revealing',
  ];

  private readonly alcoholKeywords = [
    'alcohol',
    'beer',
    'wine',
    'vodka',
    'whiskey',
    'liquor',
    'drunk',
    'drinking',
    'bar',
    'cocktail',
    'champagne',
    'spirits',
    'brewery',
  ];

  private readonly logoKeywords = [
    'logo',
    'brand',
    'trademark',
    'coca-cola',
    'pepsi',
    'nike',
    'adidas',
    'apple',
    'google',
    'microsoft',
    'facebook',
    'instagram',
    'twitter',
    'mcdonalds',
    'starbucks',
    'amazon',
    'tesla',
  ];

  private readonly violenceKeywords = [
    'violence',
    'violent',
    'kill',
    'murder',
    'blood',
    'gore',
    'weapon',
    'gun',
    'knife',
    'death',
    'war',
    'fight',
    'attack',
    'harm',
  ];

  /**
   * Moderate a prompt for inappropriate content
   */
  moderate(prompt: string): ModerationResult {
    const lowerPrompt = prompt.toLowerCase();
    const categories = {
      nudity: false,
      alcohol: false,
      logos: false,
      violence: false,
      inappropriate: false,
    };
    const scores: Record<string, number> = {};
    const flaggedTerms: string[] = [];

    // Check nudity
    const nudityMatches = this.nudityKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword),
    );
    if (nudityMatches.length > 0) {
      categories.nudity = true;
      flaggedTerms.push(...nudityMatches);
    }
    scores.nudity = nudityMatches.length / this.nudityKeywords.length;

    // Check alcohol
    const alcoholMatches = this.alcoholKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword),
    );
    if (alcoholMatches.length > 0) {
      categories.alcohol = true;
      flaggedTerms.push(...alcoholMatches);
    }
    scores.alcohol = alcoholMatches.length / this.alcoholKeywords.length;

    // Check logos
    const logoMatches = this.logoKeywords.filter((keyword) => lowerPrompt.includes(keyword));
    if (logoMatches.length > 0) {
      categories.logos = true;
      flaggedTerms.push(...logoMatches);
    }
    scores.logos = logoMatches.length / this.logoKeywords.length;

    // Check violence
    const violenceMatches = this.violenceKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword),
    );
    if (violenceMatches.length > 0) {
      categories.violence = true;
      flaggedTerms.push(...violenceMatches);
    }
    scores.violence = violenceMatches.length / this.violenceKeywords.length;

    // Set inappropriate flag if any category is flagged
    categories.inappropriate =
      categories.nudity || categories.alcohol || categories.logos || categories.violence;

    return {
      flagged: categories.inappropriate,
      categories,
      scores,
      flaggedTerms: [...new Set(flaggedTerms)], // Remove duplicates
    };
  }

  /**
   * Add custom keywords to a category
   */
  addKeywords(category: 'nudity' | 'alcohol' | 'logos' | 'violence', keywords: string[]): void {
    switch (category) {
      case 'nudity':
        this.nudityKeywords.push(...keywords);
        break;
      case 'alcohol':
        this.alcoholKeywords.push(...keywords);
        break;
      case 'logos':
        this.logoKeywords.push(...keywords);
        break;
      case 'violence':
        this.violenceKeywords.push(...keywords);
        break;
    }
  }
}
