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
      <View className="flex flex-row items-end py-2 mb-2">
        {showAvatar && (
          <View className="w-9 h-9 rounded-full mr-2 shrink-0">
            <View className="w-full h-full bg-[#00A884] rounded-full" />
          </View>
        )}
        <View className="flex flex-row items-center gap-[6px] px-4 py-2 bg-white rounded-xl rounded-bl-[2px] shadow">
          <View className="flex items-center gap-1">
            <View className="tw-dot tw-bounce-1" />
            <View className="tw-dot tw-bounce-2" />
            <View className="tw-dot tw-bounce-3" />
          </View>
          <Text className="text-[13px] text-[#667781]">{text}</Text>
        </View>
      </View>
    );
  }
}

export default TypingIndicator;
