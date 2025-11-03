export class MockRedisClient {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  async get(key: string): Promise<string | null> {
    if (this.expirations.has(key)) {
      const expiration = this.expirations.get(key)!;
      if (Date.now() > expiration) {
        this.data.delete(key);
        this.expirations.delete(key);
        return null;
      }
    }
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<'OK'> {
    this.data.set(key, value);
    if (options?.EX) {
      this.expirations.set(key, Date.now() + options.EX * 1000);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.data.has(key)) {
      this.expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    if (!this.data.has(key)) return -2;
    if (!this.expirations.has(key)) return -1;
    const expiration = this.expirations.get(key)!;
    const remaining = Math.max(0, Math.floor((expiration - Date.now()) / 1000));
    return remaining;
  }

  clear() {
    this.data.clear();
    this.expirations.clear();
  }
}

export class MockS3Client {
  private buckets: Map<string, Map<string, Buffer | string>> = new Map();

  async putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string;
  }): Promise<any> {
    if (!this.buckets.has(params.Bucket)) {
      this.buckets.set(params.Bucket, new Map());
    }
    this.buckets.get(params.Bucket)!.set(params.Key, params.Body);
    return { ETag: `"${Date.now()}"` };
  }

  async getObject(params: { Bucket: string; Key: string }): Promise<any> {
    const bucket = this.buckets.get(params.Bucket);
    if (!bucket || !bucket.has(params.Key)) {
      const error: any = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      throw error;
    }
    return {
      Body: bucket.get(params.Key),
    };
  }

  async deleteObject(params: { Bucket: string; Key: string }): Promise<any> {
    const bucket = this.buckets.get(params.Bucket);
    if (bucket) {
      bucket.delete(params.Key);
    }
    return {};
  }

  async listObjectsV2(params: { Bucket: string; Prefix?: string }): Promise<any> {
    const bucket = this.buckets.get(params.Bucket);
    if (!bucket) {
      return { Contents: [] };
    }

    const contents = Array.from(bucket.entries())
      .filter(([key]) => !params.Prefix || key.startsWith(params.Prefix))
      .map(([key, value]) => ({
        Key: key,
        Size: value.length,
        LastModified: new Date(),
      }));

    return { Contents: contents };
  }

  clear() {
    this.buckets.clear();
  }
}

export class MockDatabaseClient {
  private tables: Map<string, any[]> = new Map();
  private queries: Array<{ sql: string; params?: any[] }> = [];

  async query(sql: string, params?: any[]): Promise<any> {
    this.queries.push({ sql, params });

    if (sql.toLowerCase().includes('select')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.toLowerCase().includes('insert')) {
      return { rows: [{ id: Date.now() }], rowCount: 1 };
    }

    if (sql.toLowerCase().includes('update')) {
      return { rows: [], rowCount: 1 };
    }

    if (sql.toLowerCase().includes('delete')) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async end(): Promise<void> {
    return Promise.resolve();
  }

  getQueries() {
    return this.queries;
  }

  clearQueries() {
    this.queries = [];
  }

  setMockData(table: string, data: any[]) {
    this.tables.set(table, data);
  }

  getMockData(table: string): any[] {
    return this.tables.get(table) || [];
  }

  clear() {
    this.tables.clear();
    this.queries = [];
  }
}
