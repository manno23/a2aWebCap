/**
 * Cloudflare Workers-compatible JWT implementation
 * Uses Web Crypto API for signing/verification
 */

export interface JwtPayload {
  [key: string]: any;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface JwtSignOptions {
  algorithm?: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string | string[];
  jwtid?: string;
  notBefore?: string | number;
}

export interface JwtVerifyOptions {
  algorithms?: string[];
  issuer?: string | string[];
  audience?: string | string[];
  clockTolerance?: number;
  ignoreExpiration?: boolean;
  ignoreNotBefore?: boolean;
}

export class TokenExpiredError extends Error {
  name = 'TokenExpiredError';
  expiredAt: Date;
  
  constructor(message: string, expiredAt: Date) {
    super(message);
    this.expiredAt = expiredAt;
  }
}

export class JsonWebTokenError extends Error {
  name = 'JsonWebTokenError';
  
  constructor(message: string) {
    super(message);
  }
}

/**
 * Decode JWT token without verification
 */
export function decode(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new JsonWebTokenError('Invalid token format');
    }
    
    const payload = parts[1];
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload), c => c.charCodeAt(0))
      )
    );
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Parse duration string to seconds
 */
function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }
  
  const match = duration.match(/^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|y)$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': case 'sec': case 'secs': case 'second': case 'seconds':
      return value;
    case 'm': case 'min': case 'mins': case 'minute': case 'minutes':
      return value * 60;
    case 'h': case 'hr': case 'hrs': case 'hour': case 'hours':
      return value * 60 * 60;
    case 'd': case 'day': case 'days':
      return value * 60 * 60 * 24;
    case 'w': case 'week': case 'weeks':
      return value * 60 * 60 * 24 * 7;
    case 'y': case 'year': case 'years':
      return value * 60 * 60 * 24 * 365;
    default:
      return value;
  }
}

/**
 * Create HMAC-SHA256 signature
 */
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBytes = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  
  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verifyHmacSignature(data: string, secret: string, signature: string): Promise<boolean> {
  try {
    const expectedSignature = await createHmacSignature(data, secret);
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Sign JWT token
 */
export async function sign(
  payload: JwtPayload,
  secret: string,
  options: JwtSignOptions = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Build header
  const header = {
    alg: options.algorithm || 'HS256',
    typ: 'JWT'
  };
  
  // Build payload
  const jwtPayload: JwtPayload = { ...payload };
  
  // Set issued at time
  jwtPayload.iat = jwtPayload.iat || now;
  
  // Set issuer
  if (options.issuer) {
    jwtPayload.iss = options.issuer;
  }
  
  // Set audience
  if (options.audience) {
    jwtPayload.aud = options.audience;
  }
  
  // Set JWT ID
  if (options.jwtid) {
    jwtPayload.jti = options.jwtid;
  }
  
  // Set expiration
  if (options.expiresIn) {
    const expiresInSeconds = parseDuration(options.expiresIn);
    jwtPayload.exp = now + expiresInSeconds;
  }
  
  // Set not before
  if (options.notBefore) {
    const notBeforeSeconds = parseDuration(options.notBefore);
    jwtPayload.nbf = now + notBeforeSeconds;
  }
  
  // Encode header and payload
  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadBase64 = btoa(JSON.stringify(jwtPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // Create signature
  const dataToSign = `${headerBase64}.${payloadBase64}`;
  const signature = await createHmacSignature(dataToSign, secret);
  
  return `${dataToSign}.${signature}`;
}

/**
 * Verify JWT token
 */
export async function verify(token: string, secret: string, options: JwtVerifyOptions = {}): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JsonWebTokenError('Invalid token format');
  }
  
  const [headerBase64, payloadBase64, signature] = parts;
  
  // Verify signature
  const dataToVerify = `${headerBase64}.${payloadBase64}`;
  const isValid = await verifyHmacSignature(dataToVerify, secret, signature);
  
  if (!isValid) {
    throw new JsonWebTokenError('Invalid token signature');
  }
  
  // Decode payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payloadBase64), c => c.charCodeAt(0))
      )
    );
  } catch {
    throw new JsonWebTokenError('Invalid token payload');
  }
  
  // Verify issuer
  if (options.issuer && payload.iss) {
    const expectedIssuer = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
    if (!expectedIssuer.includes(payload.iss)) {
      throw new JsonWebTokenError('Invalid token issuer');
    }
  }
  
  // Verify audience
  if (options.audience && payload.aud) {
    const expectedAudience = Array.isArray(options.audience) ? options.audience : [options.audience];
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const hasValidAudience = tokenAudience.some(aud => expectedAudience.includes(aud));
    if (!hasValidAudience) {
      throw new JsonWebTokenError('Invalid token audience');
    }
  }
  
  // Check expiration
  if (!options.ignoreExpiration && payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = options.clockTolerance || 0;
    if (payload.exp + clockTolerance < now) {
      throw new TokenExpiredError('Token has expired', new Date(payload.exp * 1000));
    }
  }
  
  // Check not before
  if (!options.ignoreNotBefore && payload.nbf) {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = options.clockTolerance || 0;
    if (payload.nbf - clockTolerance > now) {
      throw new JsonWebTokenError('Token not active');
    }
  }
  
  return payload;
}

// Export all for compatibility with jsonwebtoken API
export default {
  sign,
  verify,
  decode,
  TokenExpiredError,
  JsonWebTokenError
};