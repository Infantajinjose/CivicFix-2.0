import jwt from 'jsonwebtoken';

export function signToken(user) {
  const tenantId = user.tenantId?._id?.toString?.() || user.tenantId?.toString?.() || null;
  return jwt.sign(
    {
      sub: user._id.toString(),
      tenantId,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
}
