import { Component } from "react";
import { View, Text, Input, Button, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import { ChatMessage } from "../../types/openclaw";
import "./index.scss";

interface ChatProps {
  chatStore?: any;
}

@inject("chatStore")
@observer
class Chat extends Component<ChatProps> {
  private inputContent: string = "";
  private scrollViewRef: any = null;

  componentDidMount() {
    this.checkConnection();
  }

  componentDidShow() {
    this.scrollToBottom();
  }

  checkConnection() {
    const { chatStore } = this.props;
    if (!chatStore?.wsUrl) {
      Taro.showModal({
        title: "提示",
        content: "您还未配置服务器地址，是否前往设置？",
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({
              url: "/pages/welcome/index",
            });
          }
        },
      });
    } else if (!chatStore?.connected) {
      this.tryConnect();
    }
  }

  async tryConnect() {
    const { chatStore } = this.props;
    try {
      await chatStore.connect();
    } catch (error) {
      console.error("Auto-connect failed:", error);
    }
  }

  handleInputChange = (e: any) => {
    this.inputContent = e.detail.value;
  };

  handleSend = async () => {
    const { chatStore } = this.props;

    if (!this.inputContent || !this.inputContent.trim()) {
      return;
    }

    if (!chatStore?.connected) {
      Taro.showToast({
        title: "未连接到服务器",
        icon: "none",
      });
      return;
    }

    const content = this.inputContent.trim();
    this.inputContent = "";
    this.forceUpdate();

    try {
      await chatStore.sendMessage(content);
      this.scrollToBottom();
    } catch (error: any) {
      Taro.showToast({
        title: error.message || "发送失败",
        icon: "none",
      });
    }
  };

  scrollToBottom = () => {
    setTimeout(() => {
      const query = Taro.createSelectorQuery();
      query.select(".messages-container").boundingClientRect();
      query.exec((res) => {
        if (res[0]) {
          this.scrollViewRef?.scrollTo({
            top: res[0].height,
            duration: 300,
          });
        }
      });
    }, 100);
  };

  handleClearHistory = () => {
    const { chatStore } = this.props;
    Taro.showModal({
      title: "确认",
      content: "确定要清空聊天记录吗？",
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

  renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    const isError = message.status === "error";

    return (
      <View
        key={message.id}
        className={`message-item ${isUser ? "user" : "assistant"}`}
      >
        <View className="message-bubble">
          {message.status === "sending" && (
            <Text className="message-status">发送中...</Text>
          )}
          {isError && <Text className="message-status error">发送失败</Text>}
          <Text className={`message-content ${isError ? "error" : ""}`}>
            {message.content}
          </Text>
          <Text className="message-time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  render() {
    const { chatStore } = this.props;
    const { messages, connected, connecting } = chatStore || {};

    return (
      <View className="chat-page">
        <View className="chat-header">
          <Text className="header-title">OpenClaw Chat</Text>
          <View className="header-actions">
            <View
              className={`status-badge ${connected ? "connected" : "disconnected"}`}
            >
              <Text className="status-text">
                {connecting ? "连接中..." : connected ? "已连接" : "未连接"}
              </Text>
            </View>
            <Button
              className="clear-btn"
              size="mini"
              onClick={this.handleClearHistory}
            >
              清空
            </Button>
          </View>
        </View>

        <ScrollView
          className="messages-container"
          scrollY
          scrollIntoView="bottom"
          ref={(ref: any) => {
            this.scrollViewRef = ref;
          }}
        >
          <View className="messages-list">
            {messages && messages.length > 0 ? (
              messages.map((msg) => this.renderMessage(msg))
            ) : (
              <View className="empty-state">
                <Text className="empty-text">暂无消息</Text>
                <Text className="empty-hint">输入消息开始聊天</Text>
              </View>
            )}
            <View id="bottom" />
          </View>
        </ScrollView>

        <View className="input-area">
          <Input
            className="message-input"
            type="text"
            placeholder="输入消息..."
            value={this.inputContent}
            onInput={this.handleInputChange}
            onConfirm={this.handleSend}
            confirmType="send"
          />
          <Button
            className={`send-btn ${!this.inputContent?.trim() || !connected ? "disabled" : ""}`}
            size="mini"
            onClick={this.handleSend}
            disabled={!this.inputContent?.trim() || !connected}
          >
            发送
          </Button>
        </View>
      </View>
    );
  }
}

export default Chat;
