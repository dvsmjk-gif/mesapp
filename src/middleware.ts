import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const middleware = async (req: NextRequest) => {
    console.log("middleware running", req.url, req.headers.get("purpose"), req.headers.get("x-nextjs-data"))

    if (req.headers.get("purpose") === "prefetch") {
        return NextResponse.next()
    }

    const pathname = req.nextUrl.pathname
    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
    if(!roomMatch){
        return NextResponse.redirect(new URL("/", req.url))
    }
    const roomId = roomMatch[1]

    const exists = await redis.exists(`meta:${roomId}`)
    if(!exists){
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    const existingToken = req.cookies.get("x-room-token")?.value
    if(existingToken){
        const isMember = await redis.sismember(`room:${roomId}:users`, existingToken)
        if(isMember){
            return NextResponse.next()
        }
    }

    const token = nanoid()
    const key = `room:${roomId}:users`

    const added = await redis.eval(
        `
        local count = redis.call('scard', KEYS[1])
        if count >= 2 then return 0 end
        redis.call('sadd', KEYS[1], ARGV[1])
        redis.call('expire', KEYS[1], 600)
        return 1
        `,
        [key],
        [token]
    )

    if(!added){
        return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    const response = NextResponse.next()
    response.cookies.set("x-room-token", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    })

    return response
}

export const config = {
    matcher: "/room/:path*",
}