import { Component } from "react";
import { View, Text } from "@tarojs/components";

interface ChatHeaderProps {
  connected: boolean;
  streaming?: boolean;
  onSettings?: () => void;
  onToggleSidebar?: () => void;
  title?: string;
  subtitle?: string;
}

class ChatHeader extends Component<ChatHeaderProps> {
  render() {
    const {
      connected,
      streaming = false,
      onSettings,
      onToggleSidebar,
      title = "OpenClaw",
      subtitle = "新会话",
    } = this.props;

    return (
      <View className="flex items-center h-14 px-3 bg-[#F0F2F5] border-b border-[#E9EDEF] relative z-10">
        <View className="flex items-center gap-1">
          {onToggleSidebar && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#D1D7DB] transition-colors"
              onClick={onToggleSidebar}
            >
              <Text className="text-[18px] text-[#54656F]">☰</Text>
            </View>
          )}
        </View>

        <View className="flex-1 flex items-center justify-center">
          <View className="flex flex-col items-center">
            <View className="flex items-center gap-2">
              <Text className="text-[16px] font-semibold text-[#111B21] leading-tight">
                {title}
              </Text>
              {streaming && (
                <View className="flex items-center gap-0.5">
                  <View
                    className="w-1 h-1 bg-[#00A884] rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <View
                    className="w-1 h-1 bg-[#00A884] rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <View
                    className="w-1 h-1 bg-[#00A884] rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </View>
              )}
            </View>
            {subtitle && (
              <Text className="text-[12px] leading-tight mt-0.5 text-[#54656F]">
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        <View className="flex items-center gap-2">
          {connected && (
            <View
              className={`w-2 h-2 rounded-full ${streaming ? "bg-[#00A884] animate-pulse" : "bg-[#25D366]"}`}
            />
          )}
          {onSettings && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#D1D7DB] transition-colors"
              onClick={onSettings}
            >
              <Text className="text-[24px] text-[#54656F]">⋮</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
}

export default ChatHeader;
