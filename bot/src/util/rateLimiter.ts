import Bottleneck from "bottleneck";

export const discordRateLimiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 1,
});

export function rateLimited<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  return (...args: any[]) => discordRateLimiter.schedule(() => fn(...args));
}
