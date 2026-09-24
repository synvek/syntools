export type HttpStatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface HttpStatus {
  code: number;
  name: string;
  cls: HttpStatusClass;
  description: string;
}

export const HTTP_STATUSES: HttpStatus[] = [
  {
    code: 100,
    name: 'Continue',
    cls: '1xx',
    description: 'Client should continue with the request.',
  },
  {
    code: 101,
    name: 'Switching Protocols',
    cls: '1xx',
    description: 'Server is switching protocols per Upgrade header.',
  },
  {
    code: 102,
    name: 'Processing',
    cls: '1xx',
    description: 'Server has received and is processing the request (WebDAV).',
  },
  {
    code: 103,
    name: 'Early Hints',
    cls: '1xx',
    description: 'Used to return some response headers before final response.',
  },
  { code: 200, name: 'OK', cls: '2xx', description: 'Standard success response.' },
  {
    code: 201,
    name: 'Created',
    cls: '2xx',
    description: 'Request succeeded and a new resource was created.',
  },
  {
    code: 202,
    name: 'Accepted',
    cls: '2xx',
    description: 'Request accepted for processing but not completed.',
  },
  { code: 204, name: 'No Content', cls: '2xx', description: 'Success with no response body.' },
  {
    code: 206,
    name: 'Partial Content',
    cls: '2xx',
    description: 'Partial response for Range requests.',
  },
  {
    code: 301,
    name: 'Moved Permanently',
    cls: '3xx',
    description: 'Resource permanently moved to a new URL.',
  },
  {
    code: 302,
    name: 'Found',
    cls: '3xx',
    description: 'Resource temporarily moved to another URL.',
  },
  {
    code: 303,
    name: 'See Other',
    cls: '3xx',
    description: 'Retrieve the resource with a GET at another URL.',
  },
  { code: 304, name: 'Not Modified', cls: '3xx', description: 'Cached copy is still valid.' },
  {
    code: 307,
    name: 'Temporary Redirect',
    cls: '3xx',
    description: 'Temporary redirect preserving the HTTP method.',
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    cls: '3xx',
    description: 'Permanent redirect preserving the HTTP method.',
  },
  {
    code: 400,
    name: 'Bad Request',
    cls: '4xx',
    description: 'Server cannot process the request due to client error.',
  },
  {
    code: 401,
    name: 'Unauthorized',
    cls: '4xx',
    description: 'Authentication is required and has failed or not been provided.',
  },
  {
    code: 402,
    name: 'Payment Required',
    cls: '4xx',
    description: 'Reserved for future use (digital payment systems).',
  },
  {
    code: 403,
    name: 'Forbidden',
    cls: '4xx',
    description: 'Server understood the request but refuses to authorize it.',
  },
  {
    code: 404,
    name: 'Not Found',
    cls: '4xx',
    description: 'Requested resource could not be found.',
  },
  {
    code: 405,
    name: 'Method Not Allowed',
    cls: '4xx',
    description: 'Request method is not supported for the resource.',
  },
  {
    code: 406,
    name: 'Not Acceptable',
    cls: '4xx',
    description: 'No content matching the Accept headers.',
  },
  {
    code: 408,
    name: 'Request Timeout',
    cls: '4xx',
    description: 'Server timed out waiting for the request.',
  },
  {
    code: 409,
    name: 'Conflict',
    cls: '4xx',
    description: 'Request conflicts with the current state of the resource.',
  },
  {
    code: 410,
    name: 'Gone',
    cls: '4xx',
    description: 'Resource is no longer available and will not be.',
  },
  {
    code: 411,
    name: 'Length Required',
    cls: '4xx',
    description: 'Content-Length header is required.',
  },
  {
    code: 412,
    name: 'Precondition Failed',
    cls: '4xx',
    description: 'A precondition in the request headers failed.',
  },
  {
    code: 413,
    name: 'Payload Too Large',
    cls: '4xx',
    description: 'Request body is larger than the server allows.',
  },
  { code: 414, name: 'URI Too Long', cls: '4xx', description: 'Requested URI is too long.' },
  {
    code: 415,
    name: 'Unsupported Media Type',
    cls: '4xx',
    description: 'Payload format is not supported.',
  },
  {
    code: 416,
    name: 'Range Not Satisfiable',
    cls: '4xx',
    description: 'Requested range cannot be satisfied.',
  },
  { code: 418, name: "I'm a teapot", cls: '4xx', description: 'April Fools joke (RFC 2324).' },
  {
    code: 422,
    name: 'Unprocessable Entity',
    cls: '4xx',
    description: 'Request is well-formed but semantically invalid (WebDAV).',
  },
  {
    code: 425,
    name: 'Too Early',
    cls: '4xx',
    description: 'Server is unwilling to risk processing a replayed request.',
  },
  {
    code: 426,
    name: 'Upgrade Required',
    cls: '4xx',
    description: 'Client should switch to a different protocol.',
  },
  {
    code: 428,
    name: 'Precondition Required',
    cls: '4xx',
    description: 'Request must be conditional to avoid lost updates.',
  },
  { code: 429, name: 'Too Many Requests', cls: '4xx', description: 'Rate limit exceeded.' },
  {
    code: 431,
    name: 'Request Header Fields Too Large',
    cls: '4xx',
    description: 'Header fields are too large.',
  },
  {
    code: 451,
    name: 'Unavailable For Legal Reasons',
    cls: '4xx',
    description: 'Resource blocked for legal reasons.',
  },
  { code: 500, name: 'Internal Server Error', cls: '5xx', description: 'Unexpected server error.' },
  {
    code: 501,
    name: 'Not Implemented',
    cls: '5xx',
    description: 'Server does not support the requested functionality.',
  },
  {
    code: 502,
    name: 'Bad Gateway',
    cls: '5xx',
    description: 'Invalid response received from an upstream server.',
  },
  {
    code: 503,
    name: 'Service Unavailable',
    cls: '5xx',
    description: 'Server is temporarily unable to handle the request.',
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    cls: '5xx',
    description: 'Upstream server failed to respond in time.',
  },
  {
    code: 505,
    name: 'HTTP Version Not Supported',
    cls: '5xx',
    description: 'HTTP protocol version is not supported.',
  },
  {
    code: 507,
    name: 'Insufficient Storage',
    cls: '5xx',
    description: 'Server cannot store the representation (WebDAV).',
  },
  {
    code: 508,
    name: 'Loop Detected',
    cls: '5xx',
    description: 'Infinite loop detected while processing (WebDAV).',
  },
  {
    code: 511,
    name: 'Network Authentication Required',
    cls: '5xx',
    description: 'Client needs to authenticate to gain network access.',
  },
];

/** 按状态码或名称/描述过滤。 */
export function filterStatuses(query: string): HttpStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return HTTP_STATUSES;
  return HTTP_STATUSES.filter(
    (s) =>
      String(s.code).includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}

export function statusClassOf(code: number): HttpStatusClass | null {
  if (code >= 100 && code < 200) return '1xx';
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return null;
}
