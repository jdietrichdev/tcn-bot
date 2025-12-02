import Bottleneck from "bottleneck";

export const discordRateLimiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 1,
});

export const clashkingRateLimiter = new Bottleneck({
  minTime: 100, // 100ms between requests to ClashKing API
  maxConcurrent: 1,
});

export function rateLimited<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  return (...args: any[]) => discordRateLimiter.schedule(() => fn(...args));
}

export function clashkingLimited<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  return (...args: any[]) => clashkingRateLimiter.schedule(() => fn(...args));
}
