import { Component } from "react";
import { View, Text } from "@tarojs/components";

interface TypingIndicatorProps {
  text?: string;
  showAvatar?: boolean;
}

class TypingIndicator extends Component<TypingIndicatorProps> {
  render() {
    const { text = "正在输入...", showAvatar } = this.props;

    return (
      <View className="flex flex-row items-end py-1 mb-1">
        {showAvatar && (
          <View className="w-8 h-8 rounded-full mr-2 shrink-0">
            <View className="w-full h-full bg-[#00A884] rounded-full flex items-center justify-center">
              <Text className="text-white text-[10px] font-semibold">AI</Text>
            </View>
          </View>
        )}
        <View className="flex flex-row items-center gap-2 px-3 py-2 bg-white rounded-lg rounded-bl-sm shadow-sm">
          <View className="flex items-center gap-0.5">
            <View className="w-1 h-1 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <View className="w-1 h-1 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <View className="w-1 h-1 bg-[#8696A0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </View>
          {text && <Text className="text-[12px] text-[#54656F]">{text}</Text>}
        </View>
      </View>
    );
  }
}

export default TypingIndicator;
