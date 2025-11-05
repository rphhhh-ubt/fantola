export enum ProductCardMode {
  CLEAN = 'clean',
  INFOGRAPHICS = 'infographics',
}

export interface ProductCardOptions {
  mode: ProductCardMode;
  background?: string;
  pose?: string;
  textHeadline?: string;
  textSubheadline?: string;
  textDescription?: string;
}

export interface CreateProductCardRequest {
  productImage: {
    data: string; // base64 encoded
    mimeType: string;
  };
  options: ProductCardOptions;
}

export interface UpdateProductCardRequest {
  options: Partial<ProductCardOptions>;
}

export interface ProductCardGenerationResponse {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  productImageUrl: string;
  mode: ProductCardMode;
  background?: string;
  pose?: string;
  textHeadline?: string;
  textSubheadline?: string;
  textDescription?: string;
  resultUrls: string[];
  errorMessage?: string;
  tokensUsed: number;
  retryCount: number;
  parentGenerationId?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProductCardModerationResult {
  approved: boolean;
  reason?: string;
  categories: {
    nudity?: boolean;
    alcohol?: boolean;
    logos?: boolean;
    violence?: boolean;
    inappropriate?: boolean;
  };
}
