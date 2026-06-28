import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const middleware = async (req: NextRequest) => {

    const pathname = req.nextUrl.pathname
    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
    if(!roomMatch){
        return NextResponse.redirect(new URL("/", req.url))
    }
    const roomId = roomMatch[1]
    const meta = await redis.hgetall<{connected: string | string[], createdAt: number}>(`meta:${roomId}`)
    if(!meta){
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    let connectedList: string[] = []
    if (Array.isArray(meta.connected)) {
        connectedList = meta.connected
    } else if (typeof meta.connected === "string") {
        try {
            connectedList = JSON.parse(meta.connected)
        } catch {
            connectedList = []
        }
    }

    const existingToken = req.cookies.get("x-room-token")?.value

    if(existingToken && connectedList.includes(existingToken)){
        return NextResponse.next()
    }

    if(connectedList.length >= 2){
        return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    const response = NextResponse.next()
    const token = nanoid()
    response.cookies.set("x-room-token", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    })

    await redis.hset(`meta:${roomId}`, {
        connected: [...connectedList, token],
    })

    return response
}

export const config = {
    matcher: "/room/:path*",
}