import { StorageAdapter, StorageConfig } from './storage-adapter';
import { LocalStorageAdapter } from './local-storage-adapter';
import { S3StorageAdapter } from './s3-storage-adapter';

export class StorageFactory {
  static createAdapter(config: StorageConfig): StorageAdapter {
    switch (config.type) {
      case 'local':
        return new LocalStorageAdapter(config);
      case 's3':
        return new S3StorageAdapter(config);
      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }
}
