import { Component } from "react";
import { View, Text } from "@tarojs/components";
import { observer } from "mobx-react";
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

// Individual message bubble component - wrapped with observer for MobX reactivity
@observer
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
          "flex max-w-full mb-1",
          isGrouped ? "mt-[-2px]" : "mt-2",
          isUser ? "flex-row-reverse ml-auto" : "flex-row mr-auto",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showAvatar && !isUser && (
          <View className="w-8 h-8 rounded-full overflow-hidden mr-2 shrink-0 shadow-sm">
            <View className="w-full h-full bg-[#00A884] flex items-center justify-center">
              <Text className="text-white text-[11px] font-semibold">AI</Text>
            </View>
          </View>
        )}
        {!showAvatar && !isUser && <View className="w-8 mr-2 shrink-0" />}

        <View
          className={[
            "relative px-2.5 py-1.5 rounded-lg max-w-full shadow-sm",
            isUser
              ? `bg-[#D9FDD3] text-[#111B21] rounded-br-sm ${
                  isGrouped ? "rounded-br-lg" : ""
                }`
              : `bg-white text-[#111B21] rounded-bl-sm ${
                  isGrouped ? "rounded-bl-lg" : ""
                }`,
            isError ? "bg-[#FEF0F0] border border-[#F8CACA]" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Status indicator for sending messages */}
          {message.status === "sending" && (
            <View className="flex items-center mb-1 opacity-60">
              <View className="tw-dot tw-bounce-1 mx-[1px] w-1 h-1 bg-[#8696A0] rounded-full" />
              <View className="tw-dot tw-bounce-2 mx-[1px] w-1 h-1 bg-[#8696A0] rounded-full" />
              <View className="tw-dot tw-bounce-3 mx-[1px] w-1 h-1 bg-[#8696A0] rounded-full" />
            </View>
          )}

          {/* Error indicator */}
          {isError && (
            <View className="flex items-center mb-1">
              <Text className="text-[#EA868F] text-[11px]">发送失败</Text>
            </View>
          )}

          {/* Message content */}
          <Text
            className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words text-[#111B21]"
            userSelect
          >
            {message.content}
            {isStreaming && (
              <Text className="ml-[1px] text-[#00A884] animate-pulse">▋</Text>
            )}
          </Text>

          {/* Timestamp and ticks */}
          <View className="flex items-center justify-end gap-1 mt-0.5">
            <Text className="text-[10px] text-[#667781]">
              {formatTime(message.timestamp)}
            </Text>
            {isUser && message.status === "sent" && (
              <Text
                className={`text-[11px] ${
                  message.read ? "text-[#53BDEB]" : "text-[#8696A0]"
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
@observer
export class MessageGroup extends Component<MessageGroupProps> {
  render() {
    const { messages, role } = this.props;
    const isUser = role === "user";

    return (
      <View
        className={`flex flex-col w-full px-2 box-border ${isUser ? "items-end" : "items-start"}`}
      >
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
