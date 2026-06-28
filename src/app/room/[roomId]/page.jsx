"use client"
import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useRealtime } from "../../../lib/realtime-client"
import { nanoid } from "nanoid"
import { useRouter } from "next/navigation"




const STORAGE_KEY = "chat_username"

const Page = () => {
    const params = useParams()
    const router = useRouter()
    const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId
    console.log("roomId", roomId)
    const username = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : ""

    function formatTimeRemaining(seconds) {
        const minutes = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${minutes}:${secs.toString().padStart(2, "0")}`
    }

    const [input, setInput] = useState("")
    const [messages, setMessages] = useState([])
    const inputRef = useRef(null)
    const [copyStatus, setCopyStatus] = useState("COPY")
    const [timeRemaining, setTimeRemaining] = useState(null)

useEffect(() => {
    if (!roomId) return

    const fetchTTL = async () => {
        const res = await fetch(`/api/room/ttl?roomId=${roomId}`)
        const data = await res.json()
        if (data.ttl > 0) {
            setTimeRemaining(data.ttl)
        }
    }

    fetchTTL()
}, [roomId])

useEffect(() => {
    if (timeRemaining === null) return
    if (timeRemaining <= 0) {
        router.push("/?error=room-destroyed")
        return
    }
    const interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
}, [timeRemaining])



useRealtime({
    channels: [`chat:${roomId}`],
    events: ["chat.message", "chat.destroy"],
    onData({ event, data }) {
        if (event === "chat.message") {
            setMessages((prev) => [...prev, data])
        }
        if (event === "chat.destroy") {
            router.push("/?error=room-destroyed")
        }
    }
})

const destroyRoom = async () => {
    await fetch(`/api/room/destroy?roomId=${roomId}`, { method: "POST" })
}

    const sendMessage = async () => {
        if (!input.trim()) return
        await fetch(`/api/message?roomId=${roomId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: username, text: input })
        })
        setInput("")
        inputRef.current?.focus()
    }

    const copyLink = () => {
        const url = window.location.href
        navigator.clipboard.writeText(url)
        setCopyStatus("COPIED")
        setTimeout(() => setCopyStatus("COPY"), 2000)
    }

    return <main className="flex flex-col h-screen max-h-screen overflow-hidden">
        <header className="bg-zinc-900/50 flex items-center justify-between backdrop-blur-md border-b border-zinc-800 p-4">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-xs text-zinc-500 uppercase">Room ID</span>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-green-700">{roomId}</span>
                        <button onClick={copyLink} className="text-xs bg-zinc-700 hover:bg-zinc-500 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-300 transition-colors">
                            {copyStatus}
                        </button>
                    </div>
                </div>

                <div className="h-8 w-px bg-zinc-600" />

                <div className="flex flex-col">
                    <span className="text-xs text-zinc-500 uppercase">Self-Destruct</span>
                    <span className={`text-sm font-bold items-center gap-2 ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"}`}>
                        {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
                    </span>
                </div>
            </div>

            <button onClick={destroyRoom} className="text-xs bg-zinc-700 hover:bg-red-700 px-3 py-1.5 rounded text-zinc-500 font-bold transition-all group flex items-center gap-2 disabled:opacity-50">
                <span className="group-hover:animate-pulse"></span>
                DESTROY ROOM
            </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === username ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-zinc-500 mb-1">{msg.sender}</span>
                    <div className={`px-4 py-2 rounded text-sm font-mono max-w-xs ${msg.sender === username ? "bg-green-900/50 text-green-300" : "bg-zinc-800 text-zinc-300"}`}>
                        {msg.text}
                    </div>
                    <span className="text-xs text-zinc-600 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                </div>
            ))}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30">
            <div className="flex gap-4">
                <div className="flex-1 relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 animate-ping [animation-delay:5s]">{">"}</span>
                    <input
                        autoFocus
                        ref={inputRef}
                        type="text"
                        value={input}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") sendMessage()
                        }}
                        placeholder="Type a message..."
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 p-3 pl-8 text-sm text-zinc-400 font-mono rounded outline-none focus:border-green-500 transition-colors"
                    />
                </div>
                <button onClick={sendMessage} className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    SEND
                </button>
            </div>
        </div>
    </main>
}

export default Page