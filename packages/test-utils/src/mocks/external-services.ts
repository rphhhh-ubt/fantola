export class MockRedisClient {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private multiCommands: any[] = [];
  private inMulti: boolean = false;

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

  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    this.data.set(key, value);
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      this.expirations.set(key, Date.now() + args[1] * 1000);
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        this.expirations.delete(key);
        count++;
      }
      if (this.sortedSets.has(key)) {
        this.sortedSets.delete(key);
        count++;
      }
      if (this.sets.has(key)) {
        this.sets.delete(key);
        count++;
      }
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) || this.sortedSets.has(key) || this.sets.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.data.has(key) || this.sortedSets.has(key) || this.sets.has(key)) {
      this.expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const hasKey = this.data.has(key) || this.sortedSets.has(key) || this.sets.has(key);
    if (!hasKey) return -2;
    if (!this.expirations.has(key)) return -1;
    const expiration = this.expirations.get(key)!;
    const remaining = Math.max(0, Math.floor((expiration - Date.now()) / 1000));
    return remaining;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const zset = this.sortedSets.get(key)!;
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;

    const minScore = typeof min === 'string' ? parseFloat(min) : min;
    const maxScore = typeof max === 'string' ? parseFloat(max) : max;

    let removed = 0;
    for (const [member, score] of zset.entries()) {
      if (score >= minScore && score <= maxScore) {
        zset.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async zcard(key: string): Promise<number> {
    const zset = this.sortedSets.get(key);
    return zset ? zset.size : 0;
  }

  async incr(key: string): Promise<number> {
    const currentValue = await this.get(key);
    const newValue = currentValue ? parseInt(currentValue, 10) + 1 : 1;
    await this.set(key, String(newValue));
    return newValue;
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    await this.set(key, value);
    await this.expire(key, seconds);
    return 'OK';
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const allKeys: string[] = [
      ...Array.from(this.data.keys()),
      ...Array.from(this.sortedSets.keys()),
      ...Array.from(this.sets.keys()),
    ];
    return allKeys.filter((key) => regex.test(key));
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  multi(): any {
    this.inMulti = true;
    this.multiCommands = [];
    
    const self = this;
    
    return {
      zadd(key: string, score: number, member: string) {
        self.multiCommands.push(['zadd', key, score, member]);
        return this;
      },
      zremrangebyscore(key: string, min: number | string, max: number | string) {
        self.multiCommands.push(['zremrangebyscore', key, min, max]);
        return this;
      },
      zcard(key: string) {
        self.multiCommands.push(['zcard', key]);
        return this;
      },
      expire(key: string, seconds: number) {
        self.multiCommands.push(['expire', key, seconds]);
        return this;
      },
      set(key: string, value: string, ...args: any[]) {
        self.multiCommands.push(['set', key, value, ...args]);
        return this;
      },
      sadd(key: string, ...members: string[]) {
        self.multiCommands.push(['sadd', key, ...members]);
        return this;
      },
      exec() {
        return self.exec();
      },
    };
  }

  async exec(): Promise<Array<[Error | null, any]> | null> {
    if (!this.inMulti) return null;

    const results: Array<[Error | null, any]> = [];

    for (const [command, ...args] of this.multiCommands) {
      try {
        let result: any;
        switch (command) {
          case 'zadd':
            result = await this.zadd(args[0], args[1], args[2]);
            break;
          case 'zremrangebyscore':
            result = await this.zremrangebyscore(args[0], args[1], args[2]);
            break;
          case 'zcard':
            result = await this.zcard(args[0]);
            break;
          case 'expire':
            result = await this.expire(args[0], args[1]);
            break;
          case 'set':
            result = await this.set(args[0], args[1], ...args.slice(2));
            break;
          case 'sadd':
            result = await this.sadd(args[0], ...args.slice(1));
            break;
          default:
            result = null;
        }
        results.push([null, result]);
      } catch (error) {
        results.push([error as Error, null]);
      }
    }

    this.inMulti = false;
    this.multiCommands = [];
    return results;
  }

  clear() {
    this.data.clear();
    this.expirations.clear();
    this.sortedSets.clear();
    this.sets.clear();
    this.multiCommands = [];
    this.inMulti = false;
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

  async send(command: any): Promise<any> {
    if (command.Bucket && command.Key && command.Body) {
      return this.putObject(command);
    }
    if (command.Bucket && command.Key && !command.Body) {
      return this.getObject(command);
    }
    return { ETag: `"${Date.now()}"` };
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
