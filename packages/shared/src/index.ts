// Export database access layer
export * from './db';

// Export queue module
export * from './queue';

// Export utility functions
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
