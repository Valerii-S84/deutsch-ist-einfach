function normalizeEnv(value: string | undefined): string | undefined {
  value = value?.trim();
  return value ? stripTrailingSlash(value) : undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

// Quiz Arena only: absence of configuration disables server-side integration.
export function getServerApiBaseUrl(): string | null {
  const internalUrl = normalizeEnv(process.env.API_INTERNAL_URL);
  if (internalUrl) {
    return internalUrl;
  }

  const publicUrl = normalizeEnv(process.env.NEXT_PUBLIC_API_URL);
  if (publicUrl && isAbsoluteUrl(publicUrl)) {
    return publicUrl;
  }

  return null;
}

export function getServerApiUrl(path: string): string | null {
  const baseUrl = getServerApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizePath(path)}` : null;
}
