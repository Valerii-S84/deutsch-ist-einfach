// Backend promo IDs are PostgreSQL bigint (up to 2^63-1). Preserve integer
// lexemes before JSON.parse can round them; quoted strings remain untouched.
export function parseQuizJson(text: string): unknown {
  const safe = text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) => {
    if (token.startsWith('"') || /[.eE]/.test(token)) return token;
    const integer = BigInt(token);
    return integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER) ? JSON.stringify(token) : token;
  });
  return JSON.parse(safe);
}
