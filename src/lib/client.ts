import { treaty } from '@elysia/eden'
import type { App } from '../app/api/[[...slugs]]/route'

// .api to enter /api prefix
export const client = treaty<App>(
  typeof window !== "undefined" ? window.location.host : "localhost:3000"
).api

