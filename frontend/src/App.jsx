import { useState, useRef } from "react"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import "./App.css"

export default function App() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const controllerRef = useRef(null)
  const retryRef = useRef(0)
  const lastUserPromptRef = useRef("")

  const MAX_RETRIES = 3

  const backoff = (attempt) => {
    return Math.min(1000 * 2 ** attempt, 8000)
  }

  const streamResponse = async (prompt) => {
    retryRef.current = 0
    controllerRef.current = new AbortController()

    await fetchEventSource(
      `http://localhost:8000/chat?prompt=${encodeURIComponent(prompt)}`,
      {
        signal: controllerRef.current.signal,

        onmessage(event) {
          setMessages(prev => {
            const last = prev[prev.length - 1]

            // Append tokens to assistant message
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { role: "assistant", content: last.content + event.data }
              ]
            }

            // First assistant token
            return [
              ...prev,
              { role: "assistant", content: event.data }
            ]
          })
        },

        onclose() {
          setLoading(false)
        },

        onerror(err) {
          if (retryRef.current < MAX_RETRIES) {
            retryRef.current += 1
            return new Promise(resolve =>
              setTimeout(resolve, backoff(retryRef.current))
            )
          }

          setLoading(false)
          throw err
        }
      }
    )
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userText = input
    lastUserPromptRef.current = userText

    // Add user message to UI
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText }
    ])

    setInput("")
    setLoading(true)

    await streamResponse(userText)
  }

  const regenerateResponse = async () => {
    if (!lastUserPromptRef.current || loading) return

    // Remove last assistant message
    setMessages(prev => {
      if (prev.length === 0) return prev
      return prev.filter((_, i) => i !== prev.length - 1)
    })

    setLoading(true)
    await streamResponse(lastUserPromptRef.current)
  }

  const stopGeneration = () => {
    controllerRef.current?.abort()
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-container">
      <h2 className="title">GenAI Learning Assistant Chatbot</h2>

      <div className="chat-box">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role}`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="typing">Assistant is typing...</div>
        )}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
          disabled={loading}
        />

        <button onClick={sendMessage} disabled={loading}>
          Send
        </button>

        <button
          onClick={regenerateResponse}
          disabled={loading || !lastUserPromptRef.current}
        >
          Regenerate
        </button>

        <button
          onClick={stopGeneration}
          disabled={!loading}
          className="stop"
        >
          Stop
        </button>
      </div>
    </div>
  )
}
