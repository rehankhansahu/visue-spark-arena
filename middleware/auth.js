// ============================================================================
// V Spark 2026 - JWT Authentication Middleware
// Lecture 9: Lightweight Auth & Role-Based Access Control (RBAC)
// ============================================================================

const jwt = require('jsonwebtoken');
const store = require('../data/store');

// Secret key for JWT signing & verification (in production, use process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'visue_spark_secret_key_2026_judge';

/**
 * Middleware to verify Sir/Judge JWT Token
 * Expects header: Authorization: Bearer <token>
 */
function verifySirToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Missing Authorization Header'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Token Format. Expected "Bearer <token>"'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Ensure the token has the judge or superadmin role
    if (decoded.role !== 'judge' && decoded.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access Forbidden: Insufficient Judge Privileges'
      });
    }

    // Option A: Single-Judge Active Session Lock (applies to judges)
    if (decoded.role === 'judge' && decoded.sessionId) {
      const active = store.getActiveJudgeSession();
      if (!active || active.sessionId !== decoded.sessionId) {
        return res.status(403).json({
          success: false,
          error: 'SESSION_SUPERSEDED',
          message: 'Access Denied: Your judge session has ended because another session was unlocked or logged out.'
        });
      }
      store.touchJudgeSession();
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Token Expired or Invalid Signature'
    });
  }
}

/**
 * Middleware to verify Super Admin JWT Token
 * Expects header: Authorization: Bearer <token>
 */
function verifySuperAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Missing Authorization Header'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Invalid Token Format. Expected "Bearer <token>"'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access Forbidden: Super Administrator privileges required.'
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Token Expired or Invalid Signature'
    });
  }
}

module.exports = {
  JWT_SECRET,
  verifySirToken,
  verifySuperAdminToken
};
