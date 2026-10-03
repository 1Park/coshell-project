// Mock until coraid login exists: the client sends the user name in a header.
export function getUser(req) {
  const user = req.headers['x-coraid-user'];
  return typeof user === 'string' && user.trim() ? user.trim() : 'anonymous';
}
