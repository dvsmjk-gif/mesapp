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
    const meta =await redis.hgetall<{connected:string[], createdAt: number }>(`meta:${roomId}`)
    console.log("meta", meta)
    console.log("connected", meta?.connected)
    console.log("connected length", (meta?.connected ?? []).length)
    if(!meta){
        return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    const existingToken = req.cookies.get("x-room-token")?.value

    if(existingToken && meta.connected?.includes(existingToken)){

        return NextResponse.next()
    }

    if((meta.connected ?? []).length >= 2){
        return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }




    const response = NextResponse.next()
    const token=nanoid()
    response.cookies.set("x-room-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",  // ← change from "strict" to "lax"
})

await redis.hset(`meta:${roomId}`, {
    connected: [...(meta.connected ?? []), token],
})
return response
}

export const config = {
    matcher:"/room/:path*",

}