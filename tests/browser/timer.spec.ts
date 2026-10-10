import { expect, test } from "@playwright/test";

test("start, pause, reset, settings and saved task work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("timer")).toHaveText("25:00");
  await page.getByLabel("МОЙ ФОКУС СЕЙЧАС").fill("Разобрать конспект");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await expect(page.getByRole("timer")).not.toHaveText("25:00");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const paused = await page.getByRole("timer").textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.reload();
  await expect(page.getByLabel("МОЙ ФОКУС СЕЙЧАС")).toHaveValue("Разобрать конспект");
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.getByRole("button", { name: "Начать интервал заново", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("25:00");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Длительность: Фокус", exact: true });
  await slider.fill("30");
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("30:00");
  await page.getByRole("tab", { name: "Фокус", exact: true }).press("ArrowRight");
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  expect(errors).toEqual([]);
});

test("a completed restored deadline earns one session and a long break on the fourth", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const now = new Date();
    localStorage.setItem("zubodoro.v1", JSON.stringify({
      settings: { focus: 25, short: 5, long: 15, autoStart: false, sound: false },
      timer: { mode: "focus", remaining: 1, deadline: Date.now() - 1000, cycle: 3,
        completed: 3, minutes: 75, day: `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}` },
    }));
  });
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("15:00");
  await expect(page.getByRole("tab", { name: "Длинный перерыв" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Отличная работа! Время отдохнуть.")).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("4 интервала");
  await page.reload();
  await expect(page.locator(".stat").first()).toContainText("4 интервала");
});

test("desktop and mobile fit their viewports", async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeEnabled();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    await page.screenshot({ path: `test-results/preview-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Закрыть настройки" }).press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});

test("expiry shows an alarm, plays sound and keeps history after reload", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const state = window as typeof window & { tones?: number };
      state.tones = (state.tones || 0) + 1;
      return original.call(this);
    };
  });
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByRole("slider", { name: "Длительность: Фокус", exact: true }).fill("1");
  const longBreak = page.getByRole("slider", { name: "Длительность: Длинный перерыв", exact: true });
  await expect(longBreak).toHaveAttribute("min", "15");
  await expect(longBreak).toHaveAttribute("max", "30");
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByLabel("МОЙ ФОКУС СЕЙЧАС").fill("Подготовить презентацию");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(page.getByRole("alert").filter({ hasText: "Время вышло!" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { tones?: number }).tones)).toBe(3);
  const history = page.getByRole("region", { name: "История таймеров" });
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(history).toContainText("Подготовить презентацию");
  await expect(history).toContainText("1 мин");
  await page.getByRole("button", { name: "Закрыть уведомление" }).click();
  await page.reload();
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Время вышло!", { exact: true })).toHaveCount(0);
  await history.getByRole("button", { name: "Перерывы", exact: true }).click();
  await expect(history.getByRole("listitem")).toHaveCount(0);
  await history.getByRole("button", { name: "Все", exact: true }).click();
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: "test-results/history-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("theme follows the device initially and saves an explicit choice", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByRole("button", { name: "Включить тёмную тему" })).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Включить светлую тему" })).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/dark-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `test-results/dark-settings-${width}.png` });
    await page.getByRole("button", { name: "Закрыть настройки" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("all seven tooth shapes stay separate from the timer and persist through pause and reload", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeEnabled();
  const shapes = new Set<string>();
  for (let variant = 1; variant <= 7; variant++) {
    await page.evaluate(variant => {
      const saved = JSON.parse(localStorage.getItem("zubodoro.v1")!);
      localStorage.setItem("zubodoro.v1", JSON.stringify({ ...saved, tooth: variant }));
    }, variant);
    await page.reload();
    await expect(page.getByRole("button", { name: "Начать", exact: true })).toBeEnabled();
    await expect(page.locator(".tooth-illustration")).toHaveAttribute("data-tooth", String(variant));
    shapes.add((await page.locator(".tooth-body").getAttribute("d"))!);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const fits = await page.evaluate(() => {
        const art = document.querySelector(".timer-art")!.getBoundingClientRect();
        const timer = document.querySelector(".timer-display")!.getBoundingClientRect();
        const controls = document.querySelector(".timer-controls")!.getBoundingClientRect();
        const svg = document.querySelector(".tooth-illustration")!.getBoundingClientRect();
        return timer.top >= art.bottom && controls.top >= timer.bottom
          && svg.left >= 0 && svg.right <= window.innerWidth
          && document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect.soft(fits, `Tooth ${variant} and timer must not overlap at ${width}px`).toBe(true);
      await page.locator("#timer-panel").screenshot({ path: `test-results/tooth-${variant}-${width}.png` });
    }
  }
  expect(shapes.size).toBe(7);
  await page.setViewportSize({ width: 320, height: 640 });
  const startBounds = await page.getByRole("button", { name: "Начать", exact: true }).boundingBox();
  expect(startBounds!.y + startBounds!.height).toBeLessThanOrEqual(640);
  await page.screenshot({ path: "test-results/compact-320.png", fullPage: true });
  const before = await page.locator(".tooth-illustration").getAttribute("data-tooth");
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.locator(".tooth-illustration")).toHaveAttribute("data-tooth", before!);
  await page.reload();
  await expect(page.locator(".tooth-illustration")).toHaveAttribute("data-tooth", before!);
  await page.getByRole("button", { name: "Начать интервал заново", exact: true }).click();
  await expect(page.locator(".tooth-illustration")).not.toHaveAttribute("data-tooth", before!);
  const reset = await page.locator(".tooth-illustration").getAttribute("data-tooth");
  await page.getByRole("tab", { name: "Перерыв", exact: true }).click();
  await expect(page.locator(".tooth-illustration")).not.toHaveAttribute("data-tooth", reset!);
});
