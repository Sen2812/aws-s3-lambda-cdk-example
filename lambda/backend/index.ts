import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

/** Bucket names allowed by this proxy (comma-separated env var). */
const ALLOWED_BUCKETS = new Set(
  (process.env.ALLOWED_BUCKETS ?? '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean),
);

/**
 * Build a 302 redirect response.
 */
function redirect(location: string): APIGatewayProxyResult {
  return {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
}

/**
 * Build a JSON error response.
 */
function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

// ─── Handler ────────────────────────────────────────────────────────
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const bucket = event.pathParameters?.bucket;
  const key = event.pathParameters?.path; // {path+} already decoded by API Gateway

  if (!bucket) {
    return error(400, 'Missing path parameter: bucket');
  }
  if (!key) {
    return error(400, 'Missing path parameter: path');
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return error(403, `Bucket "${bucket}" is not allowed`);
  }

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });

  try {
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
    console.log(`Generated pre-signed URL for s3://${bucket}/${key}`);
    return redirect(signedUrl);
  } catch (err: any) {
    console.error(`Failed to generate pre-signed URL: ${err.message}`);
    return error(500, 'Failed to generate pre-signed URL');
  }
};
