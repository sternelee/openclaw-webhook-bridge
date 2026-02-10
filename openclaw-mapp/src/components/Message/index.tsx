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
    const messageType = message.messageType || "chat";
    const isToolMessage =
      messageType === "tool_call" || messageType === "tool_result";
    const collapsed =
      message.collapsed !== undefined ? message.collapsed : isToolMessage;

    // Format timestamp
    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Get message type display info - dark theme colors
    const getMessageTypeInfo = () => {
      switch (messageType) {
        case "tool_call":
          return {
            icon: "🔧",
            label: `调用工具: ${message.toolName || "未知"}`,
            bgColor: "bg-[#1a1d25]",
            borderColor: "border-[#3f3f46]",
          };
        case "tool_result":
          return {
            icon: message.toolResult === "error" ? "❌" : "✅",
            label: `工具结果: ${message.toolName || "未知"}`,
            bgColor: "bg-[#1a1d25]",
            borderColor: message.toolResult === "error" ? "border-[#ef4444]" : "border-[#14b8a6]",
          };
        case "thought":
          return {
            icon: "💭",
            label: "思考中...",
            bgColor: "bg-[#1a1d25]",
            borderColor: "border-[#f59e0b]",
          };
        default:
          return null;
      }
    };

    const typeInfo = getMessageTypeInfo();

    // Get preview text for collapsed state
    const getPreviewText = (content: string, maxLength: number = 50) => {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === "object") {
          const keys = Object.keys(parsed);
          if (keys.length === 1) {
            return `"${keys[0]}": ${JSON.stringify(parsed[keys[0]]).slice(0, maxLength)}..."`;
          }
          return `{${keys.slice(0, 2).join(", ")}${keys.length > 2 ? ",..." : ""}`;
        }
      } catch {
        // Not JSON, just truncate
      }
      return (
        content.slice(0, maxLength) + (content.length > maxLength ? "..." : "")
      );
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
            <View className="w-full h-full bg-[#ff5c5c] flex items-center justify-center">
              <Text className="text-white text-[11px] font-semibold">AI</Text>
            </View>
          </View>
        )}
        {!showAvatar && !isUser && <View className="w-8 mr-2 shrink-0" />}

        <View
          className={[
            "relative px-2.5 py-1.5 rounded-lg max-w-full shadow-sm",
            isUser
              ? `bg-[#262a35] oc-text rounded-br-sm ${
                  isGrouped ? "rounded-br-lg" : ""
                }`
              : `bg-[#1a1d25] oc-text rounded-bl-sm border border-[#27272a] ${
                  isGrouped ? "rounded-bl-lg" : ""
                }`,
            isError ? "bg-[#1a1d25] border border-[#ef4444]" : "",
            typeInfo
              ? `${typeInfo.bgColor} border ${typeInfo.borderColor}`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            if (isToolMessage) {
              message.collapsed = !collapsed;
            }
          }}
        >
          {/* Message type indicator for tool_call, tool_result, thought */}
          {typeInfo && (
            <View className="flex items-center justify-between mb-1">
              <View className="flex items-center flex-1">
                <Text className="mr-1">{typeInfo.icon}</Text>
                <Text className="text-[12px] oc-muted font-medium">
                  {typeInfo.label}
                </Text>
              </View>
              {/* Collapse/Expand chevron */}
              <Text className="text-[12px] oc-muted ml-2 select-none">
                {collapsed ? "▶" : "▼"}
              </Text>
            </View>
          )}

          {/* Status indicator for sending messages */}
          {message.status === "sending" && (
            <View className="flex items-center mb-1 opacity-60">
              <View className="tw-dot tw-bounce-1 mx-[1px] w-1 h-1 bg-[#71717a] rounded-full" />
              <View className="tw-dot tw-bounce-2 mx-[1px] w-1 h-1 bg-[#71717a] rounded-full" />
              <View className="tw-dot tw-bounce-3 mx-[1px] w-1 h-1 bg-[#71717a] rounded-full" />
            </View>
          )}

          {/* Error indicator */}
          {isError && (
            <View className="flex items-center mb-1">
              <Text className="text-[#ef4444] text-[11px]">发送失败</Text>
            </View>
          )}

          {/* Message content - show collapsed or full */}
          {collapsed && isToolMessage ? (
            <View className="py-1">
              <Text className="text-[13px] leading-[1.4] oc-muted italic">
                {getPreviewText(message.content)}
              </Text>
              <Text className="text-[11px] oc-muted mt-1">
                点击展开查看完整内容
              </Text>
            </View>
          ) : messageType === "tool_result" &&
            message.toolResult === "error" ? (
            <Text
              className="text-[13px] leading-[1.4] whitespace-pre-wrap break-all text-[#ef4444]"
              userSelect
            >
              {message.content}
            </Text>
          ) : (
            <Text
              className="text-[14px] leading-[1.4] whitespace-pre-wrap break-all oc-text"
              userSelect
            >
              {message.content}
              {isStreaming && (
                <Text className="ml-[1px] text-[#ff5c5c] animate-pulse">▋</Text>
              )}
            </Text>
          )}

          {/* Timestamp and ticks */}
          <View className="flex items-center justify-end gap-1 mt-0.5">
            <Text className="text-[10px] oc-muted">
              {formatTime(message.timestamp)}
            </Text>
            {isUser && message.status === "sent" && (
              <Text
                className={`text-[11px] ${
                  message.read ? "text-[#3b82f6]" : "oc-muted"
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
        className={`flex flex-col w-full pl-2 pr-4 box-border ${isUser ? "items-end" : "items-start"}`}
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
