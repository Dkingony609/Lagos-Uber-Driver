import { test, expect } from "@playwright/test";
test("new game, keyboard driving, gated trip, fuel, fleet and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A day behind the wheel." }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  const y = await page.evaluate(() => window.__game!.get().owner.y);
  await page.keyboard.down("w");
  await page.waitForTimeout(1000);
  await page.keyboard.up("w");
  expect(await page.evaluate(() => window.__game!.get().owner.y)).toBeLessThan(
    y,
  );
  await page.evaluate(() => window.__game!.scenario("trip"));
  await page.getByRole("button", { name: "Accept trip" }).click();
  await page.evaluate(() => {
    const g = window.__game!;
    g.get().trip!.noShow = false;
    g.at(g.get().trip!.pickup);
    g.advance(2.1);
  });
  await page.keyboard.press("e");
  await page.evaluate(() => window.__game!.advance(0.4));
  await page.evaluate(() => {
    const g = window.__game!;
    g.at(g.get().trip!.destination);
    g.advance(2.1);
  });
  await page.keyboard.press("e");
  await expect(page.getByText("TRIP RECEIPT · COMPLETED")).toBeVisible();
  expect(await page.evaluate(() => window.__game!.get().driver.completed)).toBe(
    1,
  );
  await page.getByRole("button", { name: "Close receipt" }).click();
  await page.evaluate(() => window.__game!.at(17));
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "Buy fuel", exact: true }).click();
  expect(
    await page.evaluate(() => window.__game!.get().owner.fuel),
  ).toBeGreaterThan(29);
  await page.evaluate(() => window.__game!.scenario("fleet"));
  await page.getByRole("button", { name: /Fleet 0/ }).click();
  await page.getByRole("button", { name: /Hire Nneka/ }).click();
  await page.getByRole("button", { name: "Assign sedan", exact: true }).click();
  await page.getByRole("button", { name: "Start driver" }).click();
  await page.evaluate(() => window.__game!.advance(20));
  expect(
    await page.evaluate(() => window.__game!.get().fleet!.car.km),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.keyboard.press("Escape");
  const before = await page.evaluate(() =>
    JSON.stringify(window.__game!.get()),
  );
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => JSON.stringify(window.__game!.get()))).toBe(
    before,
  );
  await page.reload();
  await expect(page.getByText("SIMULATION PAUSED")).toBeVisible();
  expect(
    await page.evaluate(() => window.__game!.get().fleet!.car.km),
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Resume driving" }).click();
  await page.screenshot({ path: "test-results/game-1366.png", fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: "test-results/game-1920.png", fullPage: true });
});
test("active trip survives reload without a second payment", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.__game!.scenario("trip"));
  await page.getByRole("button", { name: "Accept trip" }).click();
  const trip = await page.evaluate(() => window.__game!.get().trip!.id);
  await page.reload();
  expect(await page.evaluate(() => window.__game!.get().trip!.id)).toBe(trip);
  expect(await page.evaluate(() => window.__game!.get().ledger.length)).toBe(0);
  await page.getByRole("button", { name: "Resume driving" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resume driving" }),
  ).toBeVisible();
});

test("drive a complete trip using keyboard controls, without teleporting", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/?fps=30");
  await page.evaluate(() => window.__game!.scenario("drive"));
  await page.getByRole("button", { name: "Accept trip" }).click();
  await page.evaluate(() => {
    window.__game!.get().trip!.noShow = false;
  });
  async function driveTo(y: number) {
    await page.keyboard.down("w");
    await expect
      .poll(async () => page.evaluate(() => window.__game!.get().owner.y), {
        timeout: 20000,
        intervals: [70],
      })
      .toBeLessThan(y + 10);
    await page.keyboard.up("w");
    await page.keyboard.down(" ");
    await page.waitForTimeout(2200);
    await page.keyboard.up(" ");
    await expect
      .poll(() => page.evaluate(() => window.__game!.get().trip!.gate), {
        timeout: 5000,
      })
      .toBeGreaterThanOrEqual(2);
    await page.keyboard.press("e");
  }
  await driveTo(425);
  await expect
    .poll(() => page.evaluate(() => window.__game!.get().trip!.state))
    .toBe("onboard");
  await driveTo(335);
  await expect(page.getByText("TRIP RECEIPT · COMPLETED")).toBeVisible();
  expect(
    await page.evaluate(() => window.__game!.get().owner.km),
  ).toBeGreaterThan(1.6);
  await page.screenshot({
    path: "test-results/keyboard-trip.png",
    fullPage: true,
  });
});

test("hidden-tab event freezes offers, clock and traffic until explicit resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.__game!.scenario("trip"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const frozen = await page.evaluate(() =>
    JSON.stringify(window.__game!.get()),
  );
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => JSON.stringify(window.__game!.get()))).toBe(
    frozen,
  );
  await expect(
    page.getByRole("button", { name: "Resume driving" }),
  ).toBeVisible();
});
