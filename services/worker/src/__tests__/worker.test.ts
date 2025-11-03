import {
  MockOpenAIClient,
  MockAnthropicClient,
  MockS3Client,
  createMockAIResponse,
} from '@monorepo/test-utils';

describe('Worker Service', () => {
  let openaiClient: MockOpenAIClient;
  let anthropicClient: MockAnthropicClient;
  let s3Client: MockS3Client;

  beforeEach(() => {
    openaiClient = new MockOpenAIClient();
    anthropicClient = new MockAnthropicClient();
    s3Client = new MockS3Client();
  });

  afterEach(() => {
    openaiClient.clearCalls();
    openaiClient.clearMockResponses();
    anthropicClient.clearCalls();
    anthropicClient.clearMockResponses();
    s3Client.clear();
  });

  describe('OpenAI Client', () => {
    it('should create chat completion', async () => {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.choices[0].message.content).toBe('Mocked AI response');
      expect(openaiClient.getCalls()).toHaveLength(1);
    });

    it('should use custom mock response', async () => {
      const customResponse = createMockAIResponse({
        choices: [
          {
            message: { role: 'assistant', content: 'Custom response' },
            finish_reason: 'stop',
          },
        ],
      });

      openaiClient.setMockResponse(customResponse);

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.choices[0].message.content).toBe('Custom response');
    });

    it('should track multiple calls', async () => {
      await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'First' }],
      });

      await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Second' }],
      });

      expect(openaiClient.getCalls()).toHaveLength(2);
    });
  });

  describe('Anthropic Client', () => {
    it('should create messages', async () => {
      const response = await anthropicClient.messages.create({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      });

      expect(response.content[0].text).toBe('Mocked Anthropic response');
      expect(anthropicClient.getCalls()).toHaveLength(1);
    });
  });

  describe('S3 Client', () => {
    it('should put and get objects', async () => {
      await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Body: 'test content',
      });

      const result = await s3Client.getObject({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });

      expect(result.Body).toBe('test content');
    });

    it('should throw error for non-existent object', async () => {
      await expect(
        s3Client.getObject({
          Bucket: 'test-bucket',
          Key: 'nonexistent',
        })
      ).rejects.toThrow('NoSuchKey');
    });

    it('should delete objects', async () => {
      await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Body: 'test content',
      });

      await s3Client.deleteObject({
        Bucket: 'test-bucket',
        Key: 'test-key',
      });

      await expect(
        s3Client.getObject({
          Bucket: 'test-bucket',
          Key: 'test-key',
        })
      ).rejects.toThrow('NoSuchKey');
    });

    it('should list objects with prefix', async () => {
      await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'prefix/file1.txt',
        Body: 'content1',
      });

      await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'prefix/file2.txt',
        Body: 'content2',
      });

      await s3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'other/file3.txt',
        Body: 'content3',
      });

      const result = await s3Client.listObjectsV2({
        Bucket: 'test-bucket',
        Prefix: 'prefix/',
      });

      expect(result.Contents).toHaveLength(2);
    });
  });
});
