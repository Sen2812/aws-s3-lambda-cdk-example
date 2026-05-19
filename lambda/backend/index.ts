import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

/** Bucket names allowed by this proxy (comma-separated env var). */
const ALLOWED_BUCKETS = new Set(
  (process.env.ALLOWED_BUCKETS ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean),
);

/** 302 redirect response. */
const redirect = (location: string): APIGatewayProxyResult => ({
  statusCode: 302,
  headers: { Location: location, "Cache-Control": "no-store" },
  body: "",
});

/** JSON error response. */
const error = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: message }),
});

/** API Gateway handler — validates bucket, generates pre-signed URL, returns 302. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const bucket = event.pathParameters?.bucket;
  const key = event.pathParameters?.path; // {path+} already decoded by API Gateway

  if (!bucket) return error(400, "Missing path parameter: bucket");
  if (!key) return error(400, "Missing path parameter: path");
  if (!ALLOWED_BUCKETS.has(bucket))
    return error(403, `Bucket "${bucket}" is not allowed`);

  try {
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 }, // 5 minutes
    );
    console.log(`Pre-signed URL generated for s3://${bucket}/${key}`);
    return redirect(signedUrl);
  } catch (err) {
    console.error(
      `Failed to generate pre-signed URL: ${(err as Error).message}`,
    );
    return error(500, "Failed to generate pre-signed URL");
  }
};
