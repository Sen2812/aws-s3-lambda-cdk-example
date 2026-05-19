import type {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

/**
 * Extract session_id from the Cookie header.
 * Returns the session_id value, or undefined if absent.
 */
function getSessionId(
  event: APIGatewayRequestAuthorizerEvent,
): string | undefined {
  const header = event.headers?.["Cookie"] ?? event.headers?.["cookie"];
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.substring(0, eq).trim() === "session_id") {
      return part.substring(eq + 1).trim() || undefined;
    }
  }
  return undefined;
}

/**
 * Build the IAM policy document for the API Gateway authorizer response.
 * Grants or denies execute-api:Invoke on the entire API.
 */
function buildPolicy(
  effect: "Allow" | "Deny",
  methodArn: string,
  principalId: string,
  context?: Record<string, string | number | boolean>,
): APIGatewayAuthorizerResult {
  // Wildcard: allow/deny the whole API (authorizer is per-method anyway)
  const apiArn = methodArn.split("/").slice(0, 2).join("/") + "/*";

  return {
    principalId,
    context,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: apiArn,
        },
      ],
    },
  };
}

/** REQUEST-type Lambda authorizer — validates session_id cookie. */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const sessionId = getSessionId(event);

  if (sessionId) {
    console.log("Authorized — session_id present");
    return buildPolicy("Allow", event.methodArn, sessionId, { sessionId });
  }

  console.log("Denied — session_id missing from cookie");
  return buildPolicy("Deny", event.methodArn, "unauthorized");
};
