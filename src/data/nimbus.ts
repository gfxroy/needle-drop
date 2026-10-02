import type { Corpus } from "../lib/types";

const auth = `# Authentication

Every request to the Nimbus API must be authenticated with an API key sent as a bearer token:

Authorization: Bearer nb_live_...

## Key types

Nimbus issues two kinds of keys. Live keys start with nb_live_ and act on real data and real billing. Test keys start with nb_test_ and only touch the sandbox environment; test traffic is never billed.

## Rotation

Live keys must be rotated at least every 90 days. Seven days before a key reaches 90 days, owners receive an email reminder; after 90 days the key keeps working but every response carries a Nimbus-Key-Expired: true warning header. You can hold two active live keys at the same time so that rotation causes no downtime.

## Scopes

Keys can be restricted to scopes such as files:read, files:write and billing:read. A request outside the key's scopes fails with error E1003.

## OAuth

For apps that act on behalf of other Nimbus workspaces, use OAuth 2.0 with PKCE. Access tokens last one hour; refresh tokens last 60 days and are rotated on every use.
`;

const rateLimits = `# Rate Limits

Rate limits protect the platform and are applied per API key.

## Limits by plan

- Starter plan: 120 requests per minute.
- Standard plan: 600 requests per minute.
- Scale plan: 3,000 requests per minute, with a burst bucket of 500 extra requests.

Enterprise customers can negotiate custom limits.

## Headers

Every response includes three headers so that clients can pace themselves. X-Nimbus-RateLimit-Limit is your per-minute limit. X-Nimbus-RateLimit-Remaining is the number of requests you have left in the current window. X-Nimbus-RateLimit-Reset is the Unix timestamp at which the window resets.

## When you hit the limit

Requests over the limit fail with HTTP 429 and error code E4290, and include a Retry-After header in seconds. Clients should wait at least that long before retrying. Repeatedly ignoring Retry-After can lead to a temporary block of the key.
`;

const errors = `# Error Codes

Errors return a JSON body with a code, a message and a request_id. Always log the request_id; support needs it.

## Authentication errors (E1xxx)

E1001 invalid_api_key: the key is malformed or does not exist. Check for stray whitespace.
E1002 key_revoked: the key was revoked by a workspace owner. Create a new key.
E1003 insufficient_scope: the key is valid but lacks the scope required by this endpoint.

## Request errors (E2xxx)

E2040 missing_field: a required field is absent. The message names the field.
E2041 invalid_field: a field has the wrong type or format.
E2099 payload_too_large: request bodies are limited to 10 MB; use multipart uploads for bigger files.

## Usage errors (E4xxx)

E4020 plan_feature_missing: the endpoint is not part of your plan.
E4021 quota_exceeded: your workspace has used its monthly request quota. Requests resume on the 1st of the next month (UTC), or immediately after you upgrade your plan.
E4022 storage_full: the workspace storage limit is reached. Delete files or upgrade.
E4029 seat_limit: all seats on the plan are in use.
E4290 rate_limited: too many requests in the current one-minute window. Honour the Retry-After header.

## Server errors (E5xxx)

E5000 internal_error: something broke on our side. These are rare and we are paged automatically.
E5003 upstream_timeout: a storage backend did not answer in time. The request is safe to retry with exponential backoff, up to 5 attempts.
`;

const pagination = `# Pagination

List endpoints are paginated with opaque cursors rather than page numbers, so results stay consistent while data changes.

## Parameters

Pass page_size to control how many items come back. The default page size is 50 and the maximum is 200; larger values are silently capped at 200.

Each response includes a next_cursor field. Pass it as the cursor parameter to fetch the next page. When next_cursor is null you have reached the end.

## Cursor lifetime

Cursors expire 10 minutes after they are issued. If you pass an expired cursor, the API returns error E2041 and you must restart the listing from the beginning.

## Ordering

Items are ordered by creation time, newest first, unless you pass order=asc.
`;

const webhooks = `# Webhooks

Webhooks push events such as file.created and invoice.paid to an HTTPS endpoint you control.

## Delivery

Your endpoint must respond with a 2xx status within 10 seconds, otherwise the delivery counts as failed. Nimbus retries failed deliveries up to 8 times over 24 hours with exponential backoff. After the final retry the event is marked as dropped, and you can replay it from the dashboard for up to 30 days.

## Verifying signatures

Every webhook request carries a Nimbus-Signature header. To verify that a request really came from Nimbus, compute an HMAC-SHA256 of the raw request body using your endpoint's signing secret, and compare it with the signature using a constant-time comparison. Reject requests whose timestamp is more than 5 minutes old to prevent replay attacks.

## Ordering and duplicates

Events can arrive out of order and, rarely, more than once. Use the event id to de-duplicate.
`;

const versioning = `# Versioning and SDKs

## API versions

The API is versioned by date. Pin a version by sending the Nimbus-Version header, for example Nimbus-Version: 2026-04-01. Requests without the header use the version that was current when your workspace was created.

Breaking changes only ship in new versions. When a version is deprecated, it keeps working and is sunset 12 months after deprecation. Deprecated versions return a Sunset header with the shutdown date.

## Official SDKs

Install the Python SDK with pip install nimbus-sdk and the TypeScript SDK with npm install @nimbus/sdk. Both SDKs retry E5003 and E4290 automatically and respect Retry-After.
`;

export const nimbus: Corpus = {
  id: "nimbus",
  name: "Nimbus API Docs",
  description: "Developer docs full of error codes and header names: exact strings that embeddings blur and keyword search nails.",
  docs: [
    { id: "authentication", title: "Authentication", text: auth },
    { id: "rate-limits", title: "Rate Limits", text: rateLimits },
    { id: "errors", title: "Error Codes", text: errors },
    { id: "pagination", title: "Pagination", text: pagination },
    { id: "webhooks", title: "Webhooks", text: webhooks },
    { id: "versioning", title: "Versioning & SDKs", text: versioning },
  ],
  questions: [
    {
      id: "nb-e4021",
      text: "What does error E4021 mean?",
      expected: [{ docId: "errors", quote: "E4021 quota_exceeded: your workspace has used its monthly request quota." }],
    },
    {
      id: "nb-scale",
      text: "How many requests per minute can I make on the Scale plan?",
      expected: [{ docId: "rate-limits", quote: "Scale plan: 3,000 requests per minute" }],
    },
    {
      id: "nb-webhook-down",
      text: "My server was down for a few hours. Will I lose webhook events?",
      expected: [{ docId: "webhooks", quote: "Nimbus retries failed deliveries up to 8 times over 24 hours with exponential backoff." }],
    },
    {
      id: "nb-cursor",
      text: "How long does a pagination cursor stay valid?",
      expected: [{ docId: "pagination", quote: "Cursors expire 10 minutes after they are issued." }],
    },
    {
      id: "nb-verify",
      text: "How do I check that a webhook really came from Nimbus?",
      expected: [{ docId: "webhooks", quote: "compute an HMAC-SHA256 of the raw request body using your endpoint's signing secret" }],
    },
    {
      id: "nb-remaining",
      text: "Which header tells me how many calls I have left?",
      expected: [{ docId: "rate-limits", quote: "X-Nimbus-RateLimit-Remaining is the number of requests you have left in the current window." }],
    },
    {
      id: "nb-rotate",
      text: "How often do I have to rotate live API keys?",
      expected: [{ docId: "authentication", quote: "Live keys must be rotated at least every 90 days." }],
    },
    {
      id: "nb-sunset",
      text: "What happens when an API version is deprecated?",
      expected: [{ docId: "versioning", quote: "it keeps working and is sunset 12 months after deprecation" }],
    },
    {
      id: "nb-e5003",
      text: "Should I retry after E5003?",
      expected: [{ docId: "errors", quote: "E5003 upstream_timeout: a storage backend did not answer in time. The request is safe to retry with exponential backoff, up to 5 attempts." }],
    },
    {
      id: "nb-pagesize",
      text: "max page size?",
      expected: [{ docId: "pagination", quote: "The default page size is 50 and the maximum is 200" }],
    },
  ],
};
