import { Component } from "react";
import { View, Text, Image } from "@tarojs/components";
import { ChatMessage as ChatMessageType } from "../../types/openclaw";

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
        className={[
          "flex max-w-[80%] mb-[2px]",
          isGrouped ? "mb-[1px]" : "",
          isUser ? "flex-row-reverse ml-auto" : "flex-row mr-auto",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showAvatar && !isUser && (
          <View className="w-9 h-9 rounded-full overflow-hidden mr-2 shrink-0 shadow">
            <Image
              src="https://via.placeholder.com/36/667eea/ffffff?text=AI"
              className="w-full h-full"
              lazyLoad
            />
          </View>
        )}

        <View
          className={[
            "relative px-3 py-2 rounded-xl min-w-[60px] max-w-full shadow",
            isUser
              ? `bg-[#DCF8C6] text-[#111B21] rounded-br-[2px] ${
                  isGrouped ? "rounded-tr-[2px]" : ""
                }`
              : `bg-white text-[#111B21] rounded-bl-[2px] ${
                  isGrouped ? "rounded-tl-[2px]" : ""
                }`,
            isError ? "bg-[#FFF0F0] border border-[#FFCCC7]" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Status indicator for sending messages */}
          {message.status === "sending" && (
            <View className="flex items-center mb-1">
              <View className="tw-dot tw-bounce-1 mx-[2px]" />
              <View className="tw-dot tw-bounce-2 mx-[2px]" />
              <View className="tw-dot tw-bounce-3 mx-[2px]" />
            </View>
          )}

          {/* Error indicator */}
          {isError && (
            <View className="flex items-center mb-1">
              <Text className="flex items-center justify-center w-4 h-4 rounded-full bg-[#EA868F] text-white text-[10px] font-bold">
                !
              </Text>
            </View>
          )}

          {/* Message content */}
          <Text className="text-[16px] leading-[1.4] whitespace-pre-wrap break-words text-[#111B21]">
            {message.content}
            {isStreaming && <Text className="ml-[2px] tw-blink">▋</Text>}
          </Text>

          {/* Timestamp */}
          <View className="flex items-center justify-end gap-1 mt-1">
            <Text className="text-[11px] text-[#667781]">
              {formatTime(message.timestamp)}
            </Text>
            {isUser && message.status === "sent" && (
              <Text
                className={`text-[11px] ${
                  message.read ? "text-[#34B7F1]" : "text-[#53BDEB]"
                }`}
              >
                {message.read ? "✓✓" : "✓"}
              </Text>
            )}
          </View>
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
      <View className={`flex flex-col w-full ${isUser ? "items-end" : "items-start"}`}>
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
