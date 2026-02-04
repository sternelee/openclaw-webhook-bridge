import { Component } from "react";
import { View, Text, Image } from "@tarojs/components";

interface ChatHeaderProps {
  connected: boolean;
  connecting?: boolean;
  onClear?: () => void;
  onSettings?: () => void;
  onToggleSidebar?: () => void;
  title?: string;
  subtitle?: string;
}

class ChatHeader extends Component<ChatHeaderProps> {
  render() {
    const {
      connected,
      connecting,
      onClear,
      onSettings,
      onToggleSidebar,
      title = "OpenClaw",
      subtitle = "AI 助手"
    } = this.props;

    return (
      <View className="flex items-center justify-between h-14 px-2 bg-white border-b border-[#E9EDEF] relative z-10">
        <View className="flex items-center gap-1">
          {onToggleSidebar && (
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#F0F2F5]"
              onClick={onToggleSidebar}
            >
              <Text className="text-[22px] text-[#54656F]">☰</Text>
            </View>
          )}
          <View
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#F0F2F5]"
            onClick={onSettings}
          >
            <Text className="text-[22px] text-[#54656F]">⚙</Text>
          </View>
        </View>

        <View className="flex-1 flex items-center ml-2 px-2 py-1 rounded-lg">
          <View className="relative w-10 h-10 mr-2">
            <Image
              src="https://via.placeholder.com/40/667eea/ffffff?text=AI"
              className="w-full h-full rounded-full"
              lazyLoad
            />
            <View
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                connected ? "bg-[#25D366]" : "bg-[#8696A0]"
              }`}
            />
          </View>
          <View className="flex flex-col gap-[2px]">
            <Text className="text-[17px] font-semibold text-[#111B21] leading-tight">
              {title}
            </Text>
            <Text
              className={`text-[13px] leading-tight ${
                connecting ? "text-[#00A884]" : connected ? "text-[#667781]" : "text-[#667781]"
              }`}
            >
              {connecting ? "连接中..." : connected ? subtitle : "未连接"}
            </Text>
          </View>
        </View>

        <View className="flex items-center gap-1">
          {onClear && (
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#F0F2F5]"
              onClick={onClear}
            >
              <Text className="text-[18px] text-[#54656F]">🗑</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
}

export default ChatHeader;
