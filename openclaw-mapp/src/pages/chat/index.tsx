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

interface ChatProps {
  chatStore?: any;
}

interface ChatState {
  showSettings: boolean;
  sidebarOpen: boolean;
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
      sidebarOpen: false,
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
      await chatStore.requestSessionList();
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

  handleToggleSidebar = () => {
    this.setState((prev) => ({ sidebarOpen: !prev.sidebarOpen }));
  };

  handleSelectSession = (sessionId: string) => {
    const { chatStore } = this.props;
    chatStore.setSessionId(sessionId);
    this.scrollToBottom();
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
    const {
      visibleMessages,
      sessionList,
      sessionId,
      connected,
      connecting,
      streaming,
      wsUrl,
      uid,
      sessionsLoading,
    } = chatStore || {};
    const { showSettings, sidebarOpen } = this.state;
    const messageGroups = this.groupMessages(visibleMessages || []);

    return (
      <View className="flex h-screen bg-[#E5DDD5]">
        <View className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <View
            className={`flex flex-col bg-[#0F1316] text-[#D1D7DB] border-r border-[#1C242A] transition-all duration-200 ${
              sidebarOpen ? "w-[220px]" : "w-12"
            }`}
          >
            <View className="flex items-center justify-between px-3 py-2 border-b border-[#1C242A]">
              <Text className={`${sidebarOpen ? "block" : "hidden"} text-[14px] font-semibold tracking-[0.5px] text-[#F1F6F9]`}>
                会话
              </Text>
              <View className="flex items-center gap-1.5">
                <View
                  className="w-7 h-7 rounded-md flex items-center justify-center active:bg-[#1C242A]"
                  onClick={() => chatStore?.requestSessionList?.()}
                >
                  <Text
                    className={`text-[14px] text-[#A5B1B8] ${
                      sessionsLoading ? "animate-spin" : ""
                    }`}
                  >
                    ⟳
                  </Text>
                </View>
                <View
                  className="w-7 h-7 rounded-md flex items-center justify-center active:bg-[#1C242A]"
                  onClick={this.handleToggleSidebar}
                >
                  <Text className="text-[14px] text-[#A5B1B8]">
                    {sidebarOpen ? "«" : "»"}
                  </Text>
                </View>
              </View>
            </View>
            <ScrollView className="flex-1 min-h-0" scrollY>
              {(sessionList || []).length > 0 ? (
                sessionList.map((session: { id: string }) => (
                  <View
                    key={session.id}
                    className={`px-3 py-2 text-[13px] border-b border-[#1C242A] ${
                      sessionId === session.id
                        ? "bg-[#1B2A34] text-white"
                        : "text-[#D1D7DB] active:bg-[#1C242A]"
                    }`}
                    onClick={() => this.handleSelectSession(session.id)}
                  >
                    <Text className={`${sidebarOpen ? "block" : "hidden"} truncate`}>
                      {session.id}
                    </Text>
                  </View>
                ))
              ) : (
                <View className="px-3 py-4">
                  <Text className={`${sidebarOpen ? "block" : "hidden"} text-[12px] text-[#7E8B91]`}>
                    暂无会话
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Main */}
          <View className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <ChatHeader
              connected={connected}
              connecting={connecting}
              onClear={this.handleClearHistory}
              onSettings={this.handleOpenSettings}
              onToggleSidebar={this.handleToggleSidebar}
              subtitle={sessionId ? `当前会话: ${sessionId}` : "AI 助手"}
            />

            {/* Messages */}
            <ScrollView
              className="flex-1 relative z-[1] px-4 py-3"
              scrollY
              scrollIntoView="bottom"
              ref={(ref: any) => {
                this.scrollViewRef = ref;
              }}
              enableBackToTop
            >
              <View className="flex flex-col min-h-full">
                {messageGroups.length > 0 ? (
                  messageGroups.map((group, index) => (
                    <MessageGroup
                      key={`group-${index}`}
                      messages={group.messages}
                      role={group.role}
                    />
                  ))
                ) : (
                  <View className="flex flex-col items-center justify-center py-20 px-10 gap-4 relative z-[1]">
                    <View className="text-[64px] opacity-60 mb-2">💬</View>
                    <Text className="text-[18px] font-medium text-[#667781]">
                      开始新的对话
                    </Text>
                    <Text className="text-[15px] text-[#8696A0]">
                      输入消息开始聊天
                    </Text>
                  </View>
                )}
                <View id="bottom" />
              </View>
            </ScrollView>

            {/* Typing indicator */}
            {streaming && (
              <View className="relative z-[2] px-4 pb-2">
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
          </View>
        </View>

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
