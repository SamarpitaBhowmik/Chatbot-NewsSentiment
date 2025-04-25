// FRONTEND (REACT)
// File: App.js

import React, { useState, useRef } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const addMessage = (
    sender,
    content,
    type = "text",
    fileUrl = null,
    sentiment = null
  ) => {
    const newMessage = {
      id: Date.now(),
      sender,
      content,
      type,
      fileUrl,
      sentiment,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Scroll to bottom of chat
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const fileInput = fileInputRef.current;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      addMessage("bot", "Please select a file to upload.", "error");
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    // Show file preview
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        addMessage("user", "Analyzing this image...", "image", e.target.result);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("audio/")) {
      addMessage(
        "user",
        "Analyzing this audio...",
        "audio",
        URL.createObjectURL(file)
      );
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      // Display the analysis results
      const sentiment = data.analysis?.sentiment || "neutral";
      let sentimentEmoji = "😐";
      if (sentiment === "positive") sentimentEmoji = "😃";
      if (sentiment === "negative") sentimentEmoji = "😔";

      const analysisMessage = `
      Summary: ${data.analysis?.summary} 
      
      Sentiment Analysis: ${sentiment} ${sentimentEmoji}
      
      Explanation: ${data.analysis?.reasoning || "No explanation available."}
      
      `;

      addMessage("bot", analysisMessage, "analysis", null, { sentiment });
    } catch (error) {
      console.error("Error uploading file:", error);
      addMessage("bot", `Error processing file: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Media Sentiment Analysis Chatbot</h1>
        <p>Upload images or audio for sentiment analysis</p>
      </header>

      <main>
        <div className="chat-container" ref={chatContainerRef}>
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to the Media Analysis Bot!</h2>
              <p>Upload an image or audio file to get started.</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.sender === "user" ? "user-message" : "bot-message"
              }`}
            >
              <div className="message-header">
                <span className="sender">
                  {message.sender === "user" ? "You" : "Bot"}
                </span>
                <span className="timestamp">{message.timestamp}</span>
              </div>

              <div className="message-content">
                {message.type === "image" && (
                  <div className="media-preview">
                    <img src={message.fileUrl} alt="Uploaded" />
                  </div>
                )}

                {message.type === "audio" && (
                  <div className="media-preview">
                    <audio controls src={message.fileUrl}></audio>
                  </div>
                )}

                <p>{message.content}</p>

                {message.sentiment && (
                  <div
                    className={`sentiment-tag ${message.sentiment.sentiment}`}
                  >
                    {message.sentiment.sentiment.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Processing your file...</p>
            </div>
          )}
        </div>

        <form className="upload-form" onSubmit={handleFileUpload}>
          <div className="file-input-container">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,audio/*"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Upload & Analyze"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default App;
