"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"

export const Providers = ({ children }) => {
    const [queryClient] = useState(() => new QueryClient())
    return (
        <QueryClientProvider client={queryClient}>
            <RealtimeProvider>
                {children}
            </RealtimeProvider>
        </QueryClientProvider>
    )
}