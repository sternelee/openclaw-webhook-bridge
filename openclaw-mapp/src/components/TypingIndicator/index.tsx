import { Component } from "react";
import { View, Text } from "@tarojs/components";
import "./index.scss";

interface TypingIndicatorProps {
  text?: string;
  showAvatar?: boolean;
}

class TypingIndicator extends Component<TypingIndicatorProps> {
  render() {
    const { text = "正在输入...", showAvatar } = this.props;

    return (
      <View className="typing-indicator-wrapper">
        {showAvatar && (
          <View className="typing-avatar">
            <View className="avatar-placeholder" />
          </View>
        )}
        <View className="typing-bubble">
          <View className="typing-dots">
            <View className="dot dot-1" />
            <View className="dot dot-2" />
            <View className="dot dot-3" />
          </View>
          <Text className="typing-text">{text}</Text>
        </View>
      </View>
    );
  }
}

export default TypingIndicator;
