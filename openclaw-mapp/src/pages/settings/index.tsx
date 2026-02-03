import { Component } from "react";
import { View, Text, Input, Button, Switch } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import { observable } from "mobx";
import "./index.scss";

interface SettingsProps {
  chatStore?: any;
  counterStore?: any;
}

@inject("chatStore", "counterStore")
@observer
class Settings extends Component<SettingsProps> {
  @observable wsUrlInput: string = "";
  @observable sessionIdInput: string = "";
  @observable uidInput: string = "";

  componentDidMount() {
    const { chatStore } = this.props;
    if (chatStore) {
      this.wsUrlInput = chatStore.wsUrl || "";
      this.sessionIdInput = chatStore.sessionId || "";
      this.uidInput = chatStore.uid || "";
    }
  }

  handleWsUrlChange = (e: any) => {
    this.wsUrlInput = e.detail.value;
  };

  handleSessionIdChange = (e: any) => {
    this.sessionIdInput = e.detail.value;
  };

  handleUidChange = (e: any) => {
    this.uidInput = e.detail.value;
  };

  handleSaveSettings = async () => {
    const { chatStore } = this.props;

    try {
      chatStore.setWsUrl(this.wsUrlInput.trim());
      chatStore.setSessionId(this.sessionIdInput.trim());
      chatStore.setUid(this.uidInput.trim());

      Taro.showToast({
        title: "保存成功",
        icon: "success",
      });
    } catch (error) {
      Taro.showToast({
        title: "保存失败",
        icon: "none",
      });
    }
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
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({
        title: error.message || "连接失败",
        icon: "none",
      });
    }
  };

  handleDisconnect = () => {
    const { chatStore } = this.props;
    chatStore.disconnect();
    Taro.showToast({
      title: "已断开连接",
      icon: "success",
    });
  };

  handleClearMessages = () => {
    const { chatStore } = this.props;
    Taro.showModal({
      title: "确认",
      content: "确定要清空所有聊天记录吗？",
      success: (res) => {
        if (res.confirm) {
          chatStore.clearMessages();
          Taro.showToast({
            title: "已清空",
            icon: "success",
          });
        }
      },
    });
  };

  handleAbout = () => {
    Taro.showModal({
      title: "关于 OpenClaw",
      content: "OpenClaw 是一个 AI 助手微信小程序\n\n版本: 1.0.0",
      showCancel: false,
    });
  };

  render() {
    const { chatStore, counterStore } = this.props;
    const { connected, wsUrl, sessionId, messages } = chatStore || {};
    const { count } = counterStore || {};

    return (
      <View className="settings-page">
        <View className="settings-container">
          <View className="settings-section">
            <Text className="section-title">连接状态</Text>
            <View className="status-card">
              <View
                className={`status-indicator ${connected ? "connected" : "disconnected"}`}
              >
                <Text className="status-dot"></Text>
                <Text className="status-label">
                  {connected ? "已连接" : "未连接"}
                </Text>
              </View>
            </View>
          </View>

          <View className="settings-section">
            <Text className="section-title">服务器配置</Text>
            <View className="form-group">
              <Text className="form-label">WebSocket 地址</Text>
              <Input
                className="form-input"
                type="text"
                placeholder="wss://your-server.com/ws"
                value={this.wsUrlInput}
                onInput={this.handleWsUrlChange}
              />
            </View>
            <View className="form-group">
              <Text className="form-label">Session ID（可选）</Text>
              <Input
                className="form-input"
                type="text"
                placeholder="自动生成或手动输入"
                value={this.sessionIdInput}
                onInput={this.handleSessionIdChange}
              />
            </View>
            <View className="form-group">
              <Text className="form-label">Bridge UID（必填）</Text>
              <Input
                className="form-input"
                type="text"
                placeholder="输入 Bridge 实例的 UID"
                value={this.uidInput}
                onInput={this.handleUidChange}
              />
            </View>
            <View className="button-group">
              <Button
                className="action-btn primary"
                onClick={this.handleSaveSettings}
              >
                保存配置
              </Button>
              {connected ? (
                <Button
                  className="action-btn danger"
                  onClick={this.handleDisconnect}
                >
                  断开连接
                </Button>
              ) : (
                <Button
                  className="action-btn success"
                  onClick={this.handleConnect}
                >
                  连接服务器
                </Button>
              )}
            </View>
          </View>

          <View className="settings-section">
            <Text className="section-title">数据管理</Text>
            <View className="info-card">
              <Text className="info-label">聊天消息数量</Text>
              <Text className="info-value">{messages?.length || 0}</Text>
            </View>
            <Button
              className="action-btn danger-outline"
              onClick={this.handleClearMessages}
            >
              清空聊天记录
            </Button>
          </View>

          <View className="settings-section">
            <Text className="section-title">其他</Text>
            <View className="info-card">
              <Text className="info-label">计数器示例</Text>
              <Text className="info-value">{count}</Text>
            </View>
            <View className="button-row">
              <Button
                className="mini-btn"
                onClick={() => counterStore.increment()}
              >
                +1
              </Button>
              <Button
                className="mini-btn"
                onClick={() => counterStore.decrement()}
              >
                -1
              </Button>
              <Button className="mini-btn" onClick={() => counterStore.reset()}>
                重置
              </Button>
            </View>
            <Button className="action-btn" onClick={this.handleAbout}>
              关于
            </Button>
          </View>
        </View>
      </View>
    );
  }
}

export default Settings;
