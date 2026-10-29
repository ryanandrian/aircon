import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLATFORM_TEMPLATES,
  PARTNER_TEMPLATE_KEYS,
  type PlatformTemplateKey,
} from "../src/lib/domain/platform-templates";
import { TENANT_COPY_KEYS } from "../src/lib/domain/tenant-copy";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * Structural coverage guard against orphan catalog entries: every template key
 * must be produced or consumed by a real production source file — not merely
 * listed in the catalog, the admin editor, docs, or test fixtures.
 *
 * This does NOT prove runtime delivery (that stays with E2E / production
 * evidence); it proves no catalog key is dead weight and no producer was
 * silently renamed away.
 */
describe("platform template catalog source coverage", () => {
  const keys = Object.keys(PLATFORM_TEMPLATES) as PlatformTemplateKey[];

  /** Production files that may emit a platform template notification. */
  const PRODUCER_FILES = [
    "src/lib/services/platform-notification-service.ts",
    "src/lib/services/onboarding-service.ts",
    "src/lib/services/subscription-service.ts",
    "src/lib/services/platform-notify-cycle.ts",
    "src/lib/services/wa-transition-service.ts",
    "src/lib/services/dunning-service.ts",
    "src/lib/services/inactivity-sweeper-service.ts",
    "src/lib/services/security-notify-service.ts",
    "src/lib/services/tenant-notification-service.ts",
    "src/lib/services/partner-notification-hooks.ts",
  ] as const;

  it("catalog, partner subset and tenant-copy subset stay exhaustive", () => {
    expect(keys).toHaveLength(27);
    expect(new Set(keys).size).toBe(27);
    expect(PARTNER_TEMPLATE_KEYS).toHaveLength(10);
    expect([...PARTNER_TEMPLATE_KEYS].sort()).toEqual(
      keys.filter((key) => key.startsWith("partner_")).sort(),
    );
    expect(TENANT_COPY_KEYS).toHaveLength(4);
    expect([...TENANT_COPY_KEYS].sort()).toEqual(
      keys.filter((key) => key.startsWith("tenant_")).sort(),
    );
  });

  it("every catalog key has a production producer/consumer file", () => {
    const fileText = PRODUCER_FILES.map((file) => [file, source(file)] as const);
    const orphan = keys.filter(
      (key) => !fileText.some(([, text]) => text.includes(`"${key}"`)),
    );
    expect(orphan).toEqual([]);
  });
});
