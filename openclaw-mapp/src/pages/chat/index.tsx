import { Component } from "react";
import { View, ScrollView, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import { ChatMessage as ChatMessageType } from "../../types/openclaw";
import ChatHeader from "../../components/ChatHeader";
import ChatInput from "../../components/ChatInput";
import TypingIndicator from "../../components/TypingIndicator";
import { MessageGroup } from "../../components/Message";
import SettingsModal from "../../components/SettingsModal";
import "./index.scss";

interface ChatProps {
  chatStore?: any;
}

interface ChatState {
  showSettings: boolean;
}

@inject("chatStore")
@observer
class Chat extends Component<ChatProps, ChatState> {
  private scrollViewRef: any = null;
  private inputContent: string = "";

  constructor(props: ChatProps) {
    super(props);
    this.state = {
      showSettings: false,
    };
  }

  componentDidMount() {
    this.checkConnection();
  }

  componentDidShow() {
    this.scrollToBottom();
  }

  checkConnection() {
    const { chatStore } = this.props;
    if (!chatStore?.wsUrl) {
      // Show settings modal instead of navigating
      this.setState({ showSettings: true });
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

  handleInputChange = (value: string) => {
    this.inputContent = value;
    this.forceUpdate();
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

  handleOpenSettings = () => {
    this.setState({ showSettings: true });
  };

  handleCloseSettings = () => {
    this.setState({ showSettings: false });
  };

  handleSaveSettings = async (wsUrl: string, uid: string) => {
    const { chatStore } = this.props;
    await chatStore.setWsUrl(wsUrl);
    await chatStore.setUid(uid);
    // Reconnect after saving
    if (wsUrl) {
      this.tryConnect();
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

  // Group consecutive messages from the same sender
  groupMessages = (messages: ChatMessageType[]) => {
    if (!messages || messages.length === 0) return [];

    const groups: Array<{
      role: "user" | "assistant";
      messages: ChatMessageType[];
    }> = [];

    let currentGroup: typeof groups[0] | null = null;

    messages.forEach((message) => {
      if (!currentGroup || currentGroup.role !== message.role) {
        currentGroup = {
          role: message.role,
          messages: [message],
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  };

  render() {
    const { chatStore } = this.props;
    const { messages, connected, connecting, streaming, wsUrl, uid } = chatStore || {};
    const { showSettings } = this.state;
    const messageGroups = this.groupMessages(messages || []);

    return (
      <View className="chat-page">
        {/* Header */}
        <ChatHeader
          connected={connected}
          connecting={connecting}
          onClear={this.handleClearHistory}
          onSettings={this.handleOpenSettings}
        />

        {/* Messages */}
        <ScrollView
          className="messages-container"
          scrollY
          scrollIntoView="bottom"
          ref={(ref: any) => {
            this.scrollViewRef = ref;
          }}
          enableBackToTop
        >
          <View className="messages-list">
            {messageGroups.length > 0 ? (
              messageGroups.map((group, index) => (
                <MessageGroup
                  key={`group-${index}`}
                  messages={group.messages}
                  role={group.role}
                />
              ))
            ) : (
              <View className="empty-state">
                <View className="empty-icon">💬</View>
                <Text className="empty-text">开始新的对话</Text>
                <Text className="empty-hint">输入消息开始聊天</Text>
              </View>
            )}
            <View id="bottom" />
          </View>
        </ScrollView>

        {/* Typing indicator */}
        {streaming && (
          <View className="typing-container">
            <TypingIndicator text="OpenClaw 正在思考..." />
          </View>
        )}

        {/* Input */}
        <ChatInput
          value={this.inputContent}
          placeholder="输入消息..."
          disabled={!connected}
          onInput={this.handleInputChange}
          onSend={this.handleSend}
        />

        {/* Settings Modal */}
        <SettingsModal
          visible={showSettings}
          wsUrl={wsUrl || ""}
          uid={uid || ""}
          onClose={this.handleCloseSettings}
          onSave={this.handleSaveSettings}
        />
      </View>
    );
  }
}

export default Chat;
