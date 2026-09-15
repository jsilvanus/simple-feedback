'use strict';

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require('@aws-sdk/client-s3');

function createS3Adapter({ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }) {
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    driver: 's3',

    async init() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (err) {
        const status = err.$metadata && err.$metadata.httpStatusCode;
        if (status === 404) {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        } else {
          throw err;
        }
      }
    },

    async put(key, buffer, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
    },

    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return {
          stream: result.Body,
          contentType: result.ContentType,
          contentLength: result.ContentLength,
        };
      } catch (err) {
        if (err.name === 'NoSuchKey') {
          const notFound = new Error('Object not found');
          notFound.code = 'NOT_FOUND';
          throw notFound;
        }
        throw err;
      }
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

module.exports = { createS3Adapter };
