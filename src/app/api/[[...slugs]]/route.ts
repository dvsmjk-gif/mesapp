import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { redis } from "../../../lib/redis"
import { z } from "zod"
import { realtime } from "../../../lib/realtime"

const ROOM_TTL_SECONDS = 10 * 60

const authPlugin = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId
    const token = cookie["x-room-token"]?.value as string | undefined

    if (!roomId || !token) {
      throw new Error("Unauthorized")
    }

    const isMember = await redis.sismember(`room:${roomId}:users`, token)
    if (!isMember) {
      throw new Error("Unauthorized")
    }

    return { roomId, token }
  })

const rooms = new Elysia({ prefix: '/room' })
  .post('/create', async () => {
    const roomId = nanoid()
    await redis.hset(`meta:${roomId}`, {
      connected: [],
      createdAt: Date.now()
    })
    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)
    return { roomId }
  })
  .get('/ttl', async ({ query }) => {
    const roomId = query.roomId
    if (!roomId) throw new Error("Missing roomId")
    const ttl = await redis.ttl(`meta:${roomId}`)
    return { ttl }
  })
  .post('/destroy', async ({ query }) => {
    const roomId = query.roomId
    if (!roomId) throw new Error("Missing roomId")
    const channel = realtime.channel(`chat:${roomId}`)
    await channel.emit("chat.destroy", { isDestroyed: true })
    await redis.del(`meta:${roomId}`)
    return { success: true }
  })

const messageSchema = z.object({
  sender: z.string().min(1).max(100),
  text: z.string().min(1).max(1000)
})

const messages = new Elysia({ prefix: '/message' })
  .use(authPlugin)
  .post("/", async ({ body, roomId, token }) => {
    try {
      const roomExists = await redis.exists(`meta:${roomId}`)
      if (!roomExists) {
        throw new Error("Room does not exist")
      }

      const parsed = messageSchema.safeParse(body)
      if (!parsed.success) {
        console.error("Body validation failed:", parsed.error)
        throw new Error("Invalid body")
      }
      const { sender, text } = parsed.data

      const message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      const channel = realtime.channel(`chat:${roomId}`)
      await channel.emit("chat.message", message)

      return { success: true, message }
    } catch (error) {
      console.error("Message handler error:", error)
      throw error
    }
  })

const app = new Elysia({ prefix: '/api' })
  .use(rooms)
  .use(messages)
  .get('/user', 'user:{name:"john"}')

export const GET = app.fetch
export const POST = app.fetch
export type App = typeof app