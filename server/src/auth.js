import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'tgstore_token';

export function signToken(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setAuthCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`
  );
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Attaches req.user when a valid session cookie/bearer is present. */
export function attachUser(req, _res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = readCookie(req, COOKIE_NAME) || bearer;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = payload.uid;
    } catch {
      /* invalid token -> anonymous */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
