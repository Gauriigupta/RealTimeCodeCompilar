import React, { useState, useEffect, useRef } from "react";
import "./ChatBot.css";

const ChatBox = ({ socket, username, roomId }) => {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const messagesEndRef = useRef(null);

    // Helper function for consistent time formatting
    const formatTime = (time) => {
        try {
            return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (error) {
            return "N/A";
        }
    };


    // FIX: Add filter to prevent duplicate messages for the sender
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (msg) => {
            // CRITICAL FIX: If the message is broadcast back from the server
            // and the sender matches the current user, ignore it.
            // We already displayed the message optimistically in handleSend.
            if (msg.sender === username) {
                return;
            }
            setMessages((prev) => [...prev, msg]);
        };

        socket.on("message", handleIncomingMessage);

        return () => {
            socket.off("message", handleIncomingMessage); // Use the named handler for proper cleanup
        };
        // The dependency array needs 'username' now for the filter to work correctly.
    }, [socket, username]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        const text = message.trim();
        if (!text) return;

        const msgData = {
            sender: username,
            text: text,
            time: new Date().toISOString(),
            roomId,
        };

        // 1. Emit the message to the server (send minimal data for server processing)
        // The server will extract the real sender/time from its state.
        // We only need to send the text.
        socket.emit("message", { text: text });

        // 2. Optimistic Update: Immediately display the message for the sender
        setMessages((prev) => [...prev, msgData]);

        setMessage("");
    };

    return (
        <div className="chat-wrapper">
            <h3>💬 Chat</h3>

            <div className="messages" ref={messagesEndRef}>
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`chat-message ${m.sender === username
                            ? "user-message"
                            : m.sender === "System"
                                ? "system-message"
                                : "bot-message"
                            }`}
                    >
                        <div className="meta">
                            <span className="sender">{m.sender}</span>
                            <span className="time">
                                {formatTime(m.time)}
                            </span>
                        </div>
                        <div className="text">{m.text}</div>
                    </div>
                ))}
            </div>

            <form className="send-form" onSubmit={handleSend}>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default ChatBox;