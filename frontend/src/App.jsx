import { useState, useRef } from "react"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import "./App.css"

export default function App() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const controllerRef = useRef(null)

  const sendMessage = async () => {
    if (!input.trim()) return

    const userText = input

    // 1️⃣ Add user message to UI
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText }
    ])

    setInput("")
    setLoading(true)

    controllerRef.current = new AbortController()

    // 2️⃣ Start streaming response
    await fetchEventSource(
      `http://localhost:8000/chat?prompt=${encodeURIComponent(userText)}`,
      {
        signal: controllerRef.current.signal,

        onmessage(event) {
          setMessages(prev => {
            const last = prev[prev.length - 1]

            // Append to existing assistant message
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
          setLoading(false)
          throw err
        }
      }
    )
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

        <button onClick={stopGeneration} disabled={!loading} className="stop">
          Stop
        </button>
      </div>
    </div>
  )
}
