import { expect, test } from "@playwright/test";

const runStagingReview = process.env.RUN_STAGING_VISUAL_REVIEW === "true";
const stagingUrl = process.env.STAGING_BASE_URL?.trim();
const sessionCookie = process.env.STAGING_SESSION_COOKIE?.trim();

test.describe("manual staging provider verification", () => {
  test.skip(
    !runStagingReview,
    "Set RUN_STAGING_VISUAL_REVIEW=true to opt into the real provider check.",
  );

  test("real provider grants complete only after categorical visual READY", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    expect(stagingUrl, "STAGING_BASE_URL is required").toBeTruthy();
    expect(sessionCookie, "STAGING_SESSION_COOKIE is required").toBeTruthy();

    await page.context().setExtraHTTPHeaders({ Cookie: sessionCookie! });
    await page.goto(stagingUrl!);
    await page.locator("details").last().click();
    await page
      .locator("details input")
      .fill("A premium cobalt explorer jacket with a gold compass emblem");
    await page.locator("details button[type=submit]").click();

    const canonical = page.getByTestId("canonical-result");
    await expect(canonical).toHaveAttribute("data-lifecycle", "complete", {
      timeout: 240_000,
    });
    await expect(page.getByTestId("outfit-result")).toHaveAttribute(
      "data-generation-state",
      "complete",
    );
  });
});
