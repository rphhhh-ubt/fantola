import { getConfig } from '../index';

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default config when no env vars are set', () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;

    const config = getConfig();

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
  });

  it('should use NODE_ENV from environment', () => {
    process.env.NODE_ENV = 'production';

    const config = getConfig();

    expect(config.nodeEnv).toBe('production');
  });

  it('should use PORT from environment', () => {
    process.env.PORT = '8080';

    const config = getConfig();

    expect(config.port).toBe(8080);
  });

  it('should parse PORT as integer', () => {
    process.env.PORT = '5000';

    const config = getConfig();

    expect(config.port).toBe(5000);
    expect(typeof config.port).toBe('number');
  });
});
