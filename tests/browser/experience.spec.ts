import { test, expect } from "@playwright/test";
test("3D cameras, passenger language, recorded audio, radio and local billboard campaign", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByLabel("3D Lagos driving view")).toBeVisible();
  await page.getByRole("button", { name: "Cockpit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cockpit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("c");
  await expect(
    page.getByRole("button", { name: "Orbit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Street ads", exact: true }).click();
  await page.getByLabel("Business name").fill("Lagos Bread");
  await page.getByLabel("Ad headline").fill("Fresh every morning.");
  await page.getByLabel("Ad contact").fill("Visit our Yaba bakery");
  await page.getByRole("button", { name: "Run campaign", exact: true }).click();
  await expect(
    page.getByText("Campaign is live on the street billboard."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
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
  await page.getByLabel("Passenger language").selectOption("Igbo");
  await page.getByRole("button", { name: "Discuss traffic" }).click();
  await expect(
    page.getByText("There are many cars on the road. Please be patient."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Recordings & your music/ }).click();
  await page.getByLabel("Voice line").selectOption("igbo-traffic");
  // A short generated WAV verifies actual recording import/playback, rather than synthetic speech.
  const wav = Buffer.alloc(44 + 1600);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(1600, 40);
  await page.getByLabel("Import voice recording").setInputFiles({
    name: "test-voice.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved test-voice.wav locally" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discuss traffic" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Playing recorded voice." }),
  ).toBeVisible();
  await page.getByLabel("Radio station").selectOption("Highlife guitar");
  await page.getByRole("button", { name: "Chase", exact: true }).click();
  await page.screenshot({
    path: "test-results/3d-passenger.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume driving" }).click();
  await expect(page.getByLabel("Radio station")).toHaveValue("Highlife guitar");
  await page.getByRole("button", { name: "Street ads", exact: true }).click();
  await expect(page.getByLabel("Business name")).toHaveValue("Lagos Bread");
  await page
    .getByRole("button", { name: "Pause campaign", exact: true })
    .click();
  expect(errors).toEqual([]);
});
test("fuel forecourt can be reached by driving from the road", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const v = window.__game!.get().owner;
    v.x = 515;
    v.y = 245;
    v.heading = 0;
    v.speed = 0;
  });
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__game!.get().owner.x), {
      timeout: 10000,
      intervals: [60],
    })
    .toBeGreaterThan(545);
  await page.keyboard.up("w");
  await page.keyboard.down(" ");
  await page.waitForTimeout(1700);
  await page.keyboard.up(" ");
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "Buy fuel", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buy fuel", exact: true }).click();
  expect(
    await page.evaluate(() => window.__game!.get().owner.fuel),
  ).toBeGreaterThan(29);
});
