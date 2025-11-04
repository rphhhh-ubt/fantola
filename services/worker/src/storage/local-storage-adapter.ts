import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { StorageAdapter, StorageConfig } from './storage-adapter';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private baseUrl: string;

  constructor(config: StorageConfig) {
    if (!config.localBasePath) {
      throw new Error('Local storage requires localBasePath configuration');
    }
    if (!config.baseUrl) {
      throw new Error('Local storage requires baseUrl configuration');
    }
    this.basePath = config.localBasePath;
    this.baseUrl = config.baseUrl;
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const fullPath = path.join(this.basePath, key);
    const directory = path.dirname(fullPath);

    await mkdir(directory, { recursive: true });
    await writeFile(fullPath, buffer);

    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, key);
    
    try {
      await access(fullPath, fs.constants.R_OK);
      return await readFile(fullPath);
    } catch (error) {
      throw new Error(`File not found: ${key}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    try {
      await access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    try {
      await unlink(fullPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
