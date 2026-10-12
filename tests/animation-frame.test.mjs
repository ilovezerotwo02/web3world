import assert from "node:assert/strict";
import test from "node:test";

import { cancelFrame, requestFrame } from "../app/game/animation-frame.ts";

test("animation scheduling falls back when requestAnimationFrame is unavailable", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    requestAnimationFrame: undefined,
    cancelAnimationFrame: undefined,
    setTimeout,
    clearTimeout,
  };

  try {
    const timestamp = await new Promise((resolve) => requestFrame(resolve));
    assert.equal(typeof timestamp, "number");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("animation fallback timers can be cancelled", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    requestAnimationFrame: undefined,
    cancelAnimationFrame: undefined,
    setTimeout,
    clearTimeout,
  };
  let fired = false;

  try {
    const frame = requestFrame(() => {
      fired = true;
    });
    cancelFrame(frame);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(fired, false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
