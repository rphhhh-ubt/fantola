export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockDate(dateString: string): Date {
  return new Date(dateString);
}

export function mockDateNow(timestamp: number): jest.SpyInstance {
  return jest.spyOn(Date, 'now').mockReturnValue(timestamp);
}

export function mockConsole(): {
  log: jest.SpyInstance;
  error: jest.SpyInstance;
  warn: jest.SpyInstance;
  info: jest.SpyInstance;
} {
  return {
    log: jest.spyOn(console, 'log').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    info: jest.spyOn(console, 'info').mockImplementation(),
  };
}

export function restoreConsole(): void {
  jest.restoreAllMocks();
}

export function createMockEnv(env: Record<string, string>): void {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

export function cleanupMockEnv(keys: string[]): void {
  keys.forEach((key) => {
    delete process.env[key];
  });
}

export async function expectToThrow(
  fn: () => Promise<any> | any,
  errorMessage?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect((error as Error).message).toContain(errorMessage);
      } else {
        expect((error as Error).message).toMatch(errorMessage);
      }
    }
  }
}

export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> {
  return jest.fn(implementation) as any;
}

export function createSpyObj<T extends Record<string, any>>(
  baseName: string,
  methodNames: string[]
): T {
  const obj: any = {};
  methodNames.forEach((name) => {
    obj[name] = jest.fn().mockName(`${baseName}.${name}`);
  });
  return obj as T;
}
