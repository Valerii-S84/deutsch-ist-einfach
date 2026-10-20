import { afterEach, describe, expect, it } from "vitest";

import {
  getPublicContactEmail,
  PUBLIC_YOUTUBE_CHANNEL_URL,
  TELEGRAM_BOT_START_PAYLOAD,
  getDeutschTrainerBotUrl,
  getTelegramBotUrl,
  getTelegramChannelUrl,
  getSiteUrl,
} from "./public-site-config";

const ORIGINAL_TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;
const ORIGINAL_TELEGRAM_CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
const ORIGINAL_DEUTSCH_TRAINER_BOT_URL = process.env.NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function restoreEnv(
  name:
    | "NEXT_PUBLIC_TELEGRAM_BOT_URL"
    | "NEXT_PUBLIC_TELEGRAM_CHANNEL_URL"
    | "NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL"
    | "NEXT_PUBLIC_SITE_URL"
    | "NEXT_PUBLIC_CONTACT_EMAIL",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  restoreEnv("NEXT_PUBLIC_TELEGRAM_BOT_URL", ORIGINAL_TELEGRAM_BOT_URL);
  restoreEnv("NEXT_PUBLIC_TELEGRAM_CHANNEL_URL", ORIGINAL_TELEGRAM_CHANNEL_URL);
  restoreEnv("NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL", ORIGINAL_DEUTSCH_TRAINER_BOT_URL);
  restoreEnv("NEXT_PUBLIC_SITE_URL", ORIGINAL_SITE_URL);
  restoreEnv("NEXT_PUBLIC_CONTACT_EMAIL", ORIGINAL_CONTACT_EMAIL);
});

describe("public site config", () => {
  it("keeps the YouTube channel URL stable", () => {
    expect(PUBLIC_YOUTUBE_CHANNEL_URL).toBe("https://www.youtube.com/@KommmitaufDeutsch");
  });

  it("uses the default Telegram URLs when env values are unset", () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;
    delete process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
    delete process.env.NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL;

    expect(getTelegramBotUrl()).toBe("https://t.me/Deine_Deutsch_Quiz_bot");
    expect(getTelegramChannelUrl()).toBe("https://t.me/doechkurse");
    expect(getDeutschTrainerBotUrl()).toBe("https://t.me/Trainer1512_bot");
  });

  it("trims and uses configured Telegram URLs", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL = " https://t.me/custom_bot ";
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL = " https://t.me/custom_channel ";
    process.env.NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL = " https://t.me/custom_trainer_bot ";

    expect(getTelegramBotUrl()).toBe("https://t.me/custom_bot");
    expect(getTelegramChannelUrl()).toBe("https://t.me/custom_channel");
    expect(getDeutschTrainerBotUrl()).toBe("https://t.me/custom_trainer_bot");
  });

  it("keeps the public home start payload stable", () => {
    expect(TELEGRAM_BOT_START_PAYLOAD).toBe("site_public_home");
  });

  it("uses default site URL and contact email when env values are unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;

    expect(getSiteUrl()).toBe("https://deutschmit.de");
    expect(getPublicContactEmail()).toBe("svalerii535@gmail.com");
  });

  it("trims and uses configured site URL and contact email", () => {
    process.env.NEXT_PUBLIC_SITE_URL = " https://example.quizarena.test ";
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = " hello@example.test ";

    expect(getSiteUrl()).toBe("https://example.quizarena.test");
    expect(getPublicContactEmail()).toBe("hello@example.test");
  });
});
