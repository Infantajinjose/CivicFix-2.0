import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Your session is invalid or expired. Please sign in again.' });
  }

  const query = { _id: payload.sub, active: true };
  if (payload.tenantId) {
    query.tenantId = payload.tenantId;
  }

  const user = await User.findOne(query);
  if (!user) return res.status(401).json({ success: false, message: 'Account not found or disabled.' });

  req.user = user;
  req.tenantId = user.tenantId || (payload.tenantId ? payload.tenantId : null);
  next();
});

export const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  }
  next();
};
