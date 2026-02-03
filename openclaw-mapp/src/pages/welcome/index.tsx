import { Component } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import "./index.scss";

interface WelcomeProps {
  chatStore?: any;
}

@inject("chatStore")
@observer
class Welcome extends Component<WelcomeProps> {
  private wsUrlInput: string = "";

  componentDidMount() {
    const { chatStore } = this.props;
    if (chatStore?.wsUrl) {
      this.wsUrlInput = chatStore.wsUrl;
      this.forceUpdate();
    }
  }

  handleInputChange = (e: any) => {
    this.wsUrlInput = e.detail.value;
  };

  handleConnect = async () => {
    const { chatStore } = this.props;

    if (!this.wsUrlInput || !this.wsUrlInput.trim()) {
      Taro.showToast({
        title: "请输入 WebSocket 地址",
        icon: "none",
      });
      return;
    }

    try {
      Taro.showLoading({ title: "连接中..." });

      chatStore.setWsUrl(this.wsUrlInput.trim());
      await chatStore.connect();

      Taro.hideLoading();
      Taro.showToast({
        title: "连接成功",
        icon: "success",
      });

      setTimeout(() => {
        Taro.switchTab({
          url: "/pages/chat/index",
        });
      }, 1500);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({
        title: error.message || "连接失败",
        icon: "none",
      });
    }
  };

  handleSkip = () => {
    Taro.switchTab({
      url: "/pages/chat/index",
    });
  };

  render() {
    const { chatStore } = this.props;
    const { wsUrl } = chatStore || {};

    return (
      <View className="welcome-page">
        <View className="welcome-container">
          <View className="logo-section">
            <Text className="logo-text">OpenClaw</Text>
            <Text className="logo-subtitle">AI Assistant</Text>
          </View>

          <View className="setup-section">
            <Text className="section-title">设置服务器</Text>
            <Text className="section-desc">
              请输入 WebSocket 服务器地址以连接到 OpenClaw 服务
            </Text>

            <View className="input-group">
              <Text className="input-label">WebSocket 地址</Text>
              <Input
                className="url-input"
                type="text"
                placeholder="wss://your-server.com/ws"
                value={this.wsUrlInput || wsUrl || ""}
                onInput={this.handleInputChange}
              />
            </View>

            <View className="button-group">
              <Button
                className="connect-btn primary"
                onClick={this.handleConnect}
              >
                连接服务器
              </Button>
              <Button className="skip-btn" onClick={this.handleSkip}>
                跳过，稍后设置
              </Button>
            </View>
          </View>

          <View className="info-section">
            <Text className="info-title">使用说明</Text>
            <View className="info-list">
              <View className="info-item">
                <Text className="info-dot">•</Text>
                <Text className="info-text">
                  首次使用需要配置 WebSocket 服务器地址
                </Text>
              </View>
              <View className="info-item">
                <Text className="info-dot">•</Text>
                <Text className="info-text">
                  配置后可在"设置"页面修改服务器地址
                </Text>
              </View>
              <View className="info-item">
                <Text className="info-dot">•</Text>
                <Text className="info-text">聊天记录会自动保存在本地</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

export default Welcome;
