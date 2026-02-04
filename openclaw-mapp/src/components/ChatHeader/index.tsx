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
      <View className="flex items-center justify-between h-16 px-3 bg-[#F0F2F5] border-b border-[#D1D7DB] relative z-10">
        <View className="flex items-center gap-1">
          {onToggleSidebar && (
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#D1D7DB] transition-colors"
              onClick={onToggleSidebar}
            >
              <Text className="text-[20px] text-[#54656F]">☰</Text>
            </View>
          )}
          <View
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#D1D7DB] transition-colors"
            onClick={onSettings}
          >
            <Text className="text-[20px] text-[#54656F]">⚙</Text>
          </View>
        </View>

        <View className="flex-1 flex items-center ml-2">
          <View className="relative w-10 h-10 mr-3">
            <View className="w-full h-full rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-sm">
              <Text className="text-white text-[14px] font-bold">OC</Text>
            </View>
            <View
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#F0F2F5] ${
                connected ? "bg-[#25D366]" : "bg-[#8696A0]"
              }`}
            />
          </View>
          <View className="flex flex-col">
            <Text className="text-[16px] font-bold text-[#111B21] leading-tight">
              {title}
            </Text>
            <Text
              className={`text-[12px] leading-tight mt-0.5 ${
                connecting ? "text-[#00A884]" : "text-[#667781]"
              }`}
            >
              {connecting ? "正在重新连接..." : connected ? subtitle : "离线"}
            </Text>
          </View>
        </View>

        <View className="flex items-center gap-1">
          {onClear && (
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-[#D1D7DB] transition-colors"
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
