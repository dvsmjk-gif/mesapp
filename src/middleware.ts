import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const middleware = async (req: NextRequest) => {
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
        return NextResponse.next()
    }

    const response = NextResponse.next()
    const token = nanoid()
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