export function requestFrame(callback: FrameRequestCallback): number {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  const schedule = typeof window !== "undefined" ? window.setTimeout.bind(window) : setTimeout;
  return schedule(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    callback(now);
  }, 16) as unknown as number;
}

export function cancelFrame(frameId: number) {
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
    return;
  }
  if (typeof window !== "undefined") window.clearTimeout(frameId);
  else clearTimeout(frameId);
}
