const DEFAULT_TELEGRAM_BOT_URL = "https://t.me/Deine_Deutsch_Quiz_bot";
const DEFAULT_TELEGRAM_CHANNEL_URL = "https://t.me/doechkurse";
const DEFAULT_DEUTSCH_TRAINER_BOT_URL = "https://t.me/Trainer1512_bot";
const DEFAULT_SITE_URL = "https://deutschmit.de";
export const PUBLIC_CONTACT_EMAIL = "svalerii535@gmail.com";
export const PUBLIC_YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@KommmitaufDeutsch";

export const PUBLIC_SITE_NAME = "Deutsch ist einfach!";
export const PUBLIC_SITE_DESCRIPTION =
  "Deutsch ist einfach! bietet Wissensartikel, Lernimpulse und digitale Formate. Deutsch Quiz Arena ist das Quiz-Produkt der Marke.";
export const PUBLIC_SITE_LOGO_PATH = "/logo/deutsch-ist-einfach.png";
export const PUBLIC_SITE_LOGO_WIDTH = 1082;
export const PUBLIC_SITE_LOGO_HEIGHT = 854;
export const QUIZ_PRODUCT_NAME = "Deutsch Quiz Arena";

function normalizePublicEnv(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function getTelegramBotUrl(): string {
  return normalizePublicEnv(process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL) ?? DEFAULT_TELEGRAM_BOT_URL;
}

export function getTelegramChannelUrl(): string {
  return (
    normalizePublicEnv(process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL) ??
    DEFAULT_TELEGRAM_CHANNEL_URL
  );
}

export function getDeutschTrainerBotUrl(): string {
  return (
    normalizePublicEnv(process.env.NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL) ??
    DEFAULT_DEUTSCH_TRAINER_BOT_URL
  );
}

export function getSiteUrl(): string {
  return (
    normalizePublicEnv(process.env.NEXT_PUBLIC_SITE_URL) ??
    DEFAULT_SITE_URL
  );
}

export function getPublicContactEmail(): string {
  return (
    normalizePublicEnv(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ??
    PUBLIC_CONTACT_EMAIL
  );
}

export const TELEGRAM_BOT_START_PAYLOAD = "site_public_home";
