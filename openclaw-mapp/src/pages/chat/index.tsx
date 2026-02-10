import { Component } from "react";
import { View, ScrollView, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import { ChatMessage as ChatMessageType } from "../../types/openclaw";
import ChatInput from "../../components/ChatInput";
import { MessageGroup } from "../../components/Message";
import SettingsModal from "../../components/SettingsModal";
import CommandPanel from "../../components/CommandPanel";

interface ChatProps {
  chatStore?: any;
}

interface ChatState {
  showSettings: boolean;
  sidebarOpen: boolean;
  showCommandPanel: boolean;
  statusBarHeight: number;
}

@inject("chatStore")
@observer
class Chat extends Component<ChatProps, ChatState> {
  private inputContent: string = "";

  constructor(props: ChatProps) {
    super(props);
    this.state = {
      showSettings: false,
      sidebarOpen: false,
      showCommandPanel: false,
      statusBarHeight: 44, // Default fallback
    };
  }

  componentDidMount() {
    this.checkConnection();
    this.calculateStatusBarHeight();
  }

  calculateStatusBarHeight = () => {
    try {
      const systemInfo = Taro.getSystemInfoSync();
      const menuButton = Taro.getMenuButtonBoundingClientRect();

      // 状态栏高度 = 胶囊按钮顶部位置
      // 或者使用 systemInfo.statusBarHeight
      const statusBarHeight = systemInfo.statusBarHeight || menuButton.top;

      this.setState({ statusBarHeight });
    } catch (error) {
      console.error('Failed to calculate status bar height:', error);
      // Fallback to default height (already set in constructor)
    }
  };

  componentDidUpdate(prevProps: ChatProps) {
    // Auto-scroll when new messages arrive
    const prevMessageCount = prevProps.chatStore?.messages?.length || 0;
    const currentMessageCount = this.props.chatStore?.messages?.length || 0;
    if (currentMessageCount > prevMessageCount) {
      this.scrollToBottom();
    }
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

  handleToggleCommandPanel = () => {
    this.setState((prev) => ({ showCommandPanel: !prev.showCommandPanel }));
  };

  handleCommandSelect = (command: string) => {
    const { chatStore } = this.props;

    // If command ends with space, it needs parameters - fill input
    if (command.endsWith(' ')) {
      this.inputContent = command;
      this.forceUpdate();
    } else {
      // No parameters needed - send directly
      chatStore.sendMessage(command);
    }
    this.setState({ showCommandPanel: false });
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
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      // Scroll to bottom using #bottom element
      Taro.createSelectorQuery()
        .select("#bottom")
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res) => {
          const bottomRect = res[0] as any;
          const scrollRes = res[1] as any;
          if (bottomRect && scrollRes) {
            const systemInfo = Taro.getSystemInfoSync();
            const windowHeight = systemInfo.windowHeight;
            const scrollTop = scrollRes.scrollTop || 0;
            // Calculate target scroll position
            const targetTop = scrollTop + bottomRect.top - windowHeight + 60;
            Taro.pageScrollTo({
              scrollTop: Math.max(0, targetTop),
              duration: 100,
            });
          }
        });
    }, 150);
  };

  // Group consecutive messages from the same sender
  groupMessages = (messages: ChatMessageType[]) => {
    if (!messages || messages.length === 0) return [];

    const groups: Array<{
      role: "user" | "assistant";
      messages: ChatMessageType[];
    }> = [];

    let currentGroup: (typeof groups)[0] | null = null;

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
      streaming,
      wsUrl,
      uid,
      sessionsLoading,
    } = chatStore || {};
    const { showSettings, sidebarOpen, showCommandPanel, statusBarHeight } = this.state;
    const messageGroups = this.groupMessages(visibleMessages || []);

    return (
      <View className="flex h-screen oc-bg">
        {/* Status bar spacer for capsule button */}
        <View style={{ height: statusBarHeight }} className="oc-bg w-full fixed top-0 left-0 z-50" />

        <View className="flex flex-1 min-h-0" style={{ paddingTop: statusBarHeight }}>
          {/* Sidebar */}
          <View
            className={`flex flex-col oc-bg-elevated text-[#D1D7DB] border-r border-[#27272a] transition-all duration-300 ease-in-out overflow-hidden ${
              sidebarOpen ? "w-[280px]" : "w-0"
            }`}
          >
            <View className="flex flex-col items-center justify-between px-4 py-3 h-14 bg-[#1a1d25]">
              <View className="flex items-center w-full justify-between">
                <Text className="text-[16px] font-semibold oc-text-strong">
                  OpenClaw
                </Text>
                <View
                  className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#262a35] transition-colors"
                  onClick={this.handleToggleSidebar}
                >
                  <Text className="text-[16px] oc-muted">✕</Text>
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
                        className={`flex items-center mx-3 my-1 px-3 py-3 rounded-lg transition-all ${
                          sessionId === session.id
                            ? "bg-[#262a35] oc-text-strong"
                            : "oc-text active:bg-[#262a35]"
                        }`}
                        onClick={() => {
                          this.handleSelectSession(session.id);
                          this.handleToggleSidebar(); // Close sidebar after selecting
                        }}
                      >
                        <View className="w-10 h-10 rounded-full bg-[#ff5c5c] flex items-center justify-center mr-3 shrink-0">
                          <Text className="text-[16px]">💬</Text>
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-[14px] font-medium truncate oc-text-strong">
                            {session.id}
                          </Text>
                          <Text className="text-[12px] oc-muted truncate">
                            点击查看对话
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="py-8 flex flex-col items-center justify-center">
                      <Text className="text-[32px] mb-2 opacity-30">💬</Text>
                      <Text className="text-[13px] oc-muted text-center">
                        暂无会话记录
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Create New Session Button */}
              <View className="px-3 py-2 border-t border-[#27272a]">
                <View
                  className="flex items-center rounded-lg px-3 py-2.5 active:bg-[#262a35] transition-colors justify-start"
                  onClick={() => {
                    const { chatStore } = this.props;
                    chatStore.setSessionId("");
                    this.handleToggleSidebar();
                  }}
                >
                  <View className="w-9 h-9 rounded-full flex items-center justify-center bg-[#ff5c5c] mr-3">
                    <Text className="text-[18px] text-white font-light">+</Text>
                  </View>
                  <Text className="text-[14px] font-medium oc-text-strong">
                    新会话
                  </Text>
                </View>
              </View>

              {/* Sidebar Footer */}
              <View className="p-3 border-t border-[#27272a] space-y-1">
                <View
                  className="flex items-center rounded-lg px-3 py-2 active:bg-[#262a35] transition-colors justify-start"
                  onClick={this.handleClearHistory}
                >
                  <View className="w-9 h-9 rounded-full flex items-center justify-center bg-[#3f3f46] mr-3">
                    <Text className="text-[16px] oc-text-strong">🗑</Text>
                  </View>
                  <Text className="text-[14px] oc-text">清空对话</Text>
                </View>
                <View
                  className="flex items-center rounded-lg px-3 py-2 active:bg-[#262a35] transition-colors justify-start"
                  onClick={() => chatStore?.requestSessionList?.()}
                >
                  <View className="w-9 h-9 rounded-full flex items-center justify-center bg-[#3f3f46] mr-3">
                    <Text
                      className={`text-[16px] oc-muted ${sessionsLoading ? "animate-spin" : ""}`}
                    >
                      ⟳
                    </Text>
                  </View>
                  <Text className="text-[14px] oc-text">刷新列表</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Main */}
          <View className="flex flex-col flex-1 min-w-0 oc-bg">
            {/* Header */}
            <View className="flex items-center h-12 px-3 header-frosted">
              <View
                className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#262a35] transition-colors"
                onClick={this.handleToggleSidebar}
              >
                <Text className="text-[18px] oc-text">☰</Text>
              </View>
              <View className="flex-1 flex flex-col items-center justify-center">
                <View className="flex items-center gap-2">
                  <Text className="text-[15px] font-semibold oc-text-strong">
                    {sessionId ? sessionId : "OpenClaw"}
                  </Text>
                  {streaming && (
                    <View className="flex items-center gap-0.5">
                      <View
                        className="w-1 h-1 bg-[#ff5c5c] rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <View
                        className="w-1 h-1 bg-[#ff5c5c] rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <View
                        className="w-1 h-1 bg-[#ff5c5c] rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </View>
                  )}
                </View>
              </View>
              <View className="w-9 flex items-center justify-end">
                {connected && (
                  <View
                    className={`w-2 h-2 rounded-full ${streaming ? "bg-[#ff5c5c] animate-pulse" : "bg-[#22c55e]"}`}
                  />
                )}
              </View>
            </View>

            {/* Messages */}
            <ScrollView
              className="flex-1 relative z-[1] py-3 overflow-hidden"
              scrollY
              scrollIntoView="bottom"
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
                    <View className="w-20 h-20 rounded-full bg-[#ff5c5c] flex items-center justify-center mb-5">
                      <Text className="text-[36px]">🤖</Text>
                    </View>
                    <Text className="text-[18px] font-semibold oc-text-strong mb-2">
                      OpenClaw AI
                    </Text>
                    <Text className="text-[14px] oc-muted text-center max-w-[260px]">
                      开始新对话，或从侧边栏选择历史会话
                    </Text>
                  </View>
                )}
                <View id="bottom" />
              </View>
            </ScrollView>

            {/* Input */}
            <ChatInput
              value={this.inputContent}
              placeholder="输入消息..."
              disabled={!connected}
              onInput={this.handleInputChange}
              onSend={this.handleSend}
              onCommandClick={this.handleToggleCommandPanel}
            />
          </View>
        </View>

        {/* Command Panel */}
        {showCommandPanel && (
          <CommandPanel
            onClose={this.handleToggleCommandPanel}
            onCommandSelect={this.handleCommandSelect}
            onOpenSettings={this.handleOpenSettings}
          />
        )}

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
