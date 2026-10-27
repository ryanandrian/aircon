import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { platformTemplateOptions } from "../src/lib/services/platform-notification-admin";

describe("platformTemplateOptions", () => {
  it("hides transaction-bound activation from manual send, keeps regular notices manual", () => {
    const options = platformTemplateOptions();
    const activation = options.find((item) => item.key === "subscription_activated");
    expect(activation?.manualAllowed).toBe(false);
    expect(options.filter((item) => item.manualAllowed).map((item) => item.key)).toEqual([
      "welcome_basic",
      "welcome_paid",
      "subscription_due",
      "subscription_overdue",
      "wa_connected",
      "wa_disconnected",
    ]);
  });
});
