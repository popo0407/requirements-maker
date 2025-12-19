import jwt from 'jsonwebtoken';

/**
 * JWT Authentication Utilities
 * 
 * SECURITY NOTE: This is a stub implementation for development.
 * In production, ensure:
 * 1. Use a strong secret key (stored in AWS Secrets Manager or environment variable)
 * 2. Implement proper token expiration and refresh
 * 3. Validate issuer and audience claims
 * 4. Use RS256 (RSA) instead of HS256 for better security
 * 5. Implement token blacklisting for logout
 */

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token
 * 
 * @param payload - User data to encode in token
 * @returns JWT token string
 */
export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify and decode JWT token
 * 
 * @param token - JWT token string
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract user ID from Authorization header
 * 
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns User ID from token
 * @throws Error if header is missing or token is invalid
 */
export function extractUserIdFromAuthHeader(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new Error('Authorization header is required');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid authorization header format. Expected: Bearer <token>');
  }

  const token = parts[1];
  const payload = verifyToken(token);
  
  return payload.userId;
}

/**
 * Development-only: Generate a test token
 * WARNING: Remove this function in production
 */
export function generateTestToken(userId: string = 'test-user-id'): string {
  return generateToken({
    userId,
    email: 'test@example.com',
  });
}
