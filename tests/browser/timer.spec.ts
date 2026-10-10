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
