import { Component } from "react";
import { View, Text, Image } from "@tarojs/components";
import "./index.scss";

interface ChatHeaderProps {
  connected: boolean;
  connecting?: boolean;
  onClear?: () => void;
  onSettings?: () => void;
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
      title = "OpenClaw",
      subtitle = "AI 助手"
    } = this.props;

    return (
      <View className="chat-header">
        {/* Settings button */}
        <View className="header-back" onClick={onSettings}>
          <Text className="settings-icon">⚙</Text>
        </View>

        {/* Avatar and title section */}
        <View className="header-info">
          <View className="header-avatar">
            <Image
              src="https://via.placeholder.com/40/667eea/ffffff?text=AI"
              className="avatar-image"
              lazyLoad
            />
            <View
              className={`avatar-status ${connected ? "online" : "offline"}`}
            />
          </View>
          <View className="header-text">
            <Text className="header-title">{title}</Text>
            <Text className={`header-subtitle ${connecting ? "connecting" : ""}`}>
              {connecting ? "连接中..." : connected ? subtitle : "未连接"}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View className="header-actions">
          {onClear && (
            <View className="header-action" onClick={onClear}>
              <Text className="action-icon">🗑</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
}

export default ChatHeader;
