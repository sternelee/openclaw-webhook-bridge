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
      <View className="flex h-screen bg-[#F0F2F5]">
        <View className="flex flex-1 min-h-0">
          {/* Sidebar */}

          <View
            className={`flex flex-col bg-[#111B21] text-[#D1D7DB] border-r border-[#222D34] transition-all duration-300 ease-in-out ${
              sidebarOpen ? "w-[240px]" : "w-16"
            }`}
          >
            <View className="flex flex-col items-center justify-between px-3 py-4 h-14 border-b border-[#222D34]">
              <View className={`flex items-center w-full ${sidebarOpen ? "justify-between" : "justify-center"}`}>
                <Text className={`${sidebarOpen ? "block" : "hidden"} text-[16px] font-bold tracking-tight text-[#E9EDEF]`}>
                  会话列表
                </Text>
                <View
                  className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#2A3942] transition-colors"
                  onClick={this.handleToggleSidebar}
                >
                  <Text className="text-[16px] text-[#A5B1B8]">
                    {sidebarOpen ? "«" : "»"}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1 flex flex-col min-h-0">
              <ScrollView className="flex-1 no-scrollbar" scrollY>
                <View className="py-2">
                  {(sessionList || []).length > 0 ? (
                    sessionList.map((session: { id: string }) => (
                      <View
                        key={session.id}
                        className={`flex items-center mx-2 my-1 px-3 py-3 rounded-xl transition-all ${
                          sessionId === session.id
                            ? "bg-[#2A3942] text-[#E9EDEF] shadow-sm"
                            : "text-[#D1D7DB] active:bg-[#202C33]"
                        }`}
                        onClick={() => this.handleSelectSession(session.id)}
                      >
                        <View className="w-8 h-8 rounded-lg bg-[#202C33] flex items-center justify-center mr-3 shrink-0">
                          <Text className="text-[14px]">💬</Text>
                        </View>
                        <View className={`flex-1 min-w-0 ${sidebarOpen ? "block" : "hidden"}`}>
                          <Text className="text-[14px] font-medium truncate">
                            {session.id}
                          </Text>
                          <Text className="text-[11px] text-[#8696A0] truncate">
                            最近活动
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="px-4 py-8 flex flex-col items-center justify-center">
                      <Text className="text-[24px] mb-2 opacity-20">📭</Text>
                      <Text className={`${sidebarOpen ? "block" : "hidden"} text-[13px] text-[#8696A0] text-center`}>
                        暂无活跃会话
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Sidebar Footer */}
              <View className="p-3 border-t border-[#222D34]">
                <View
                  className={`flex items-center rounded-xl p-2 active:bg-[#2A3942] transition-colors ${
                    sidebarOpen ? "justify-start" : "justify-center"
                  }`}
                  onClick={() => chatStore?.requestSessionList?.()}
                >
                  <View className={`w-8 h-8 rounded-full flex items-center justify-center bg-[#202C33] ${sidebarOpen ? "mr-3" : ""}`}>
                    <Text className={`text-[16px] text-[#A5B1B8] ${sessionsLoading ? "animate-spin" : ""}`}>
                      ⟳
                    </Text>
                  </View>
                  {sidebarOpen && (
                    <Text className="text-[13px] font-medium text-[#D1D7DB]">刷新列表</Text>
                  )}
                </View>
              </View>
            </View>
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
                  <View className="flex-1 flex flex-col items-center justify-center py-20 px-6">
                    <View className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                      <Text className="text-[48px]">🤖</Text>
                    </View>
                    <Text className="text-[20px] font-bold text-[#111B21] mb-2">
                      欢迎使用 OpenClaw
                    </Text>
                    <Text className="text-[14px] text-[#667781] text-center max-w-[240px]">
                      您可以选择一个现有会话，或者直接输入消息开始新的对话。
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
