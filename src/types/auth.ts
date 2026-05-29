export type UserRole = 'SYSTEM_OWNER' | 'ADMIN' | 'MANAGER' | 'USER' | 'KITCHEN';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  tenantId?: string | null;
  exp?: number;
  iat?: number;
  purpose?: string;
}

export interface SessionUser {
  userId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  tenantId?: string | null;
}

