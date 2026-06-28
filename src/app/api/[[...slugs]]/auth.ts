import { Elysia, t } from "elysia"
import { redis } from "../../../lib/redis"

class AuthError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "AuthError"
    }

}

export const middleware = new Elysia({name: "auth"})
.error({AuthError})
.onError(({code,set}) => {
    if(code === "AuthError"){
        set.status = 401
        return {error: "Unauthorized"}
    }

})
.derive({as:"scoped"}, async({query,cookie}) =>{
    const RoomId = query.roomId
    const token = cookie["x-room-token"].value as string | undefined

    if(!RoomId || !token){
        throw new AuthError("Missing roomId or token")
        
    }
    const connected = await redis.hget<string[]>(`meta:${RoomId}`, "connected")

    if(!connected?.includes(token)){
        throw new AuthError("Invalid token")
    }

    return {auth: {RoomId, token, connected}}
})
