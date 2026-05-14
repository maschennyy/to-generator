import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const loginRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
})