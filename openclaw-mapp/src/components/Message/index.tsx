import { Component } from "react";
import { View, Text, Image } from "@tarojs/components";
import { ChatMessage as ChatMessageType } from "../../types/openclaw";
import "./index.scss";

interface MessageBubbleProps {
  message: ChatMessageType;
  isGrouped?: boolean;
  showAvatar?: boolean;
  isStreaming?: boolean;
}

interface MessageGroupProps {
  messages: ChatMessageType[];
  role: "user" | "assistant";
}

// Individual message bubble component
class MessageBubble extends Component<MessageBubbleProps> {
  render() {
    const { message, isGrouped, showAvatar, isStreaming } = this.props;
    const isUser = message.role === "user";
    const isError = message.status === "error";

    // Format timestamp
    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <View
        className={`message-bubble-wrapper ${isUser ? "user" : "assistant"} ${isGrouped ? "grouped" : ""}`}
      >
        {showAvatar && !isUser && (
          <View className="message-avatar">
            <Image
              src="https://via.placeholder.com/36/667eea/ffffff?text=AI"
              className="avatar-image"
              lazyLoad
            />
          </View>
        )}

        <View className={`message-bubble ${isStreaming ? "streaming" : ""} ${isError ? "error" : ""}`}>
          {/* Status indicator for sending messages */}
          {message.status === "sending" && (
            <View className="message-status-indicator sending">
              <View className="dot dot-1" />
              <View className="dot dot-2" />
              <View className="dot dot-3" />
            </View>
          )}

          {/* Error indicator */}
          {isError && (
            <View className="message-status-indicator error">
              <Text className="error-icon">!</Text>
            </View>
          )}

          {/* Read receipts for user messages */}
          {isUser && message.status === "sent" && (
            <View className="read-receipt">
              <View className={`checkmark ${message.read ? "read" : ""}`} />
              {message.read && <View className={`checkmark ${message.read ? "read" : ""}`} />}
            </View>
          )}

          {/* Message content */}
          <Text className={`message-content ${isUser ? "user" : "assistant"}`}>
            {message.content}
          </Text>

          {/* Timestamp */}
          <Text className={`message-timestamp ${isUser ? "user" : "assistant"}`}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  }
}

// Message group component (groups consecutive messages from same sender)
export class MessageGroup extends Component<MessageGroupProps> {
  render() {
    const { messages, role } = this.props;
    const isUser = role === "user";

    return (
      <View className={`message-group ${isUser ? "user" : "assistant"}`}>
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isGrouped={index > 0}
            showAvatar={index === 0 && !isUser}
            isStreaming={message.status === "streaming"}
          />
        ))}
      </View>
    );
  }
}

export default MessageBubble;
