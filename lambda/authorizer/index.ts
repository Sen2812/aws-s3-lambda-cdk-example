import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  PolicyDocument,
} from 'aws-lambda';

/**
 * Parse a Cookie header string and extract named values.
 * e.g. "session_id=abc; foo=bar" → { session_id: "abc", foo: "bar" }
 */
function parseCookies(header: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!header) return map;
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.substring(0, eqIdx).trim();
    const value = part.substring(eqIdx + 1).trim();
    if (key) map[key] = value;
  }
  return map;
}

/**
 * Build the IAM policy response that API Gateway expects from a
 * REQUEST-type Lambda authorizer.
 */
function buildPolicy(
  effect: 'Allow' | 'Deny',
  methodArn: string,
  principalId: string,
  context?: Record<string, string | number | boolean>,
): APIGatewayAuthorizerResult {
  // Convert the full methodArn to a wildcard resource:
  // arn:aws:execute-api:region:account:api-id/stage/GET/resource
  // → allow/deny the whole API (authorizer is scoped to one method anyway)
  const resource = methodArn.split('/').slice(0, 2).join('/') + '/*';

  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  return {
    principalId,
    policyDocument,
    context,
  };
}

// ─── Handler ────────────────────────────────────────────────────────
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const cookies = parseCookies(event.headers?.['Cookie'] ?? event.headers?.['cookie']);
  const sessionId = cookies['session_id'];

  if (sessionId && sessionId.length > 0) {
    console.log('Authorized — session_id present');
    return buildPolicy('Allow', event.methodArn, sessionId, {
      sessionId,
    });
  }

  console.log('Denied — session_id missing from cookie');
  return buildPolicy('Deny', event.methodArn, 'unauthorized');
};
