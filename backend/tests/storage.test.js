/**
 * Storage adapter unit tests — local disk adapter runs against a real temp
 * directory; the S3 adapter mocks @aws-sdk/client-s3 so no real bucket is needed.
 */
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const { createLocalAdapter } = require('../src/services/storage/localAdapter');

describe('local storage adapter', () => {
  let baseDir;
  let adapter;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    adapter = createLocalAdapter({ baseDir });
    await adapter.init();
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  test('put then get returns the same bytes', async () => {
    await adapter.put('foo.txt', Buffer.from('hello world'));
    const obj = await adapter.get('foo.txt');
    const chunks = [];
    for await (const chunk of obj.stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('hello world');
    expect(obj.contentLength).toBe(Buffer.byteLength('hello world'));
  });

  test('get on a missing key throws with code NOT_FOUND', async () => {
    await expect(adapter.get('missing.txt')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('delete removes the object; get afterwards is NOT_FOUND', async () => {
    await adapter.put('bar.txt', Buffer.from('bye'));
    await adapter.delete('bar.txt');
    await expect(adapter.get('bar.txt')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('delete on a missing key does not throw', async () => {
    await expect(adapter.delete('never-existed.txt')).resolves.toBeUndefined();
  });

  test('rejects keys that escape the base directory', async () => {
    await expect(adapter.put('../escape.txt', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
    await expect(adapter.get('../escape.txt')).rejects.toThrow('Invalid storage key');
  });
});

describe('s3 storage adapter', () => {
  let sendMock;
  let createS3Adapter;

  beforeEach(() => {
    jest.resetModules();
    sendMock = jest.fn();

    jest.doMock('@aws-sdk/client-s3', () => {
      class FakeCommand {
        constructor(input) { this.input = input; }
      }
      return {
        S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
        PutObjectCommand: class extends FakeCommand {},
        GetObjectCommand: class extends FakeCommand {},
        DeleteObjectCommand: class extends FakeCommand {},
        HeadBucketCommand: class extends FakeCommand {},
        CreateBucketCommand: class extends FakeCommand {},
      };
    });

    ({ createS3Adapter } = require('../src/services/storage/s3Adapter'));
  });

  function makeAdapter() {
    return createS3Adapter({
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      forcePathStyle: true,
    });
  }

  test('init creates the bucket when HeadBucket 404s', async () => {
    sendMock
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValueOnce({});

    const adapter = makeAdapter();
    await adapter.init();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1][0].input).toEqual({ Bucket: 'test-bucket' });
  });

  test('init does not create the bucket when it already exists', async () => {
    sendMock.mockResolvedValueOnce({});
    const adapter = makeAdapter();
    await adapter.init();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test('put sends a PutObjectCommand with the buffer and content type', async () => {
    sendMock.mockResolvedValueOnce({});
    const adapter = makeAdapter();
    await adapter.put('key.png', Buffer.from('data'), 'image/png');

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'key.png',
      ContentType: 'image/png',
    });
  });

  test('get returns a NOT_FOUND error for a missing key', async () => {
    const err = new Error('no such key');
    err.name = 'NoSuchKey';
    sendMock.mockRejectedValueOnce(err);

    const adapter = makeAdapter();
    await expect(adapter.get('missing.png')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('delete sends a DeleteObjectCommand', async () => {
    sendMock.mockResolvedValueOnce({});
    const adapter = makeAdapter();
    await adapter.delete('key.png');

    expect(sendMock.mock.calls[0][0].input).toEqual({ Bucket: 'test-bucket', Key: 'key.png' });
  });
});
