import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config';

const client = new S3Client({
  region: 'auto',
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export async function createPresignedPutUrl(
  objectKey: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: config.presignExpiresSeconds });
}

export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: objectKey }));
    return true;
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

export async function deleteObject(objectKey: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: objectKey }));
}

export function getPublicUrl(objectKey: string): string {
  return `${config.r2.publicUrl}/${objectKey}`;
}
