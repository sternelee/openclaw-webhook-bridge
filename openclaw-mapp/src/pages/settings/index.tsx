import { Component } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";
import { observable } from "mobx";

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
  @observable peerKindInput: string = "";
  @observable peerIdInput: string = "";
  @observable topicIdInput: string = "";
  @observable threadIdInput: string = "";

  componentDidMount() {
    const { chatStore } = this.props;
    if (chatStore) {
      this.wsUrlInput = chatStore.wsUrl || "";
      this.sessionIdInput = chatStore.sessionId || "";
      this.uidInput = chatStore.uid || "";
      this.peerKindInput = chatStore.peerKind || "";
      this.peerIdInput = chatStore.peerId || "";
      this.topicIdInput = chatStore.topicId || "";
      this.threadIdInput = chatStore.threadId || "";
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

  handlePeerKindChange = (e: any) => {
    this.peerKindInput = e.detail.value;
  };

  handlePeerIdChange = (e: any) => {
    this.peerIdInput = e.detail.value;
  };

  handleTopicIdChange = (e: any) => {
    this.topicIdInput = e.detail.value;
  };

  handleThreadIdChange = (e: any) => {
    this.threadIdInput = e.detail.value;
  };

  handleSaveSettings = async () => {
    const { chatStore } = this.props;

    try {
      chatStore.setWsUrl(this.wsUrlInput.trim());
      chatStore.setSessionId(this.sessionIdInput.trim());
      chatStore.setUid(this.uidInput.trim());
      chatStore.setPeerKind(this.peerKindInput.trim());
      chatStore.setPeerId(this.peerIdInput.trim());
      chatStore.setTopicId(this.topicIdInput.trim());
      chatStore.setThreadId(this.threadIdInput.trim());

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
    const { connected, messages } = chatStore || {};
    const { count } = counterStore || {};

    return (
      <View className="min-h-screen bg-[#E5DDD5] p-4 box-border">
        <View className="flex flex-col gap-4">
          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-4">
              连接状态
            </Text>
            <View className="p-4 bg-[#F0F2F5] rounded-xl">
              <View
                className="flex items-center gap-2"
              >
                <Text
                  className={`w-[10px] h-[10px] rounded-full ${
                    connected ? "bg-[#25D366]" : "bg-[#EA868F]"
                  }`}
                />
                <Text
                  className={`text-[16px] font-medium ${
                    connected ? "text-[#25D366]" : "text-[#EA868F]"
                  }`}
                >
                  {connected ? "已连接" : "未连接"}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-4">
              服务器配置
            </Text>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                WebSocket 地址
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="wss://your-server.com/ws"
                value={this.wsUrlInput}
                onInput={this.handleWsUrlChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                Session ID（可选）
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="自动生成或手动输入"
                value={this.sessionIdInput}
                onInput={this.handleSessionIdChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                Bridge UID（必填）
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="输入 Bridge 实例的 UID"
                value={this.uidInput}
                onInput={this.handleUidChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                话题/会话路由（可选）
              </Text>
              <View className="text-[12px] text-[#8696A0] mt-[-4px] leading-[1.4]">
                不填 sessionId 时，可用 peerKind/peerId/topicId/threadId 生成 Telegram 风格会话。
              </View>
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                peerKind
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="dm | group | channel"
                value={this.peerKindInput}
                onInput={this.handlePeerKindChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                peerId
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="用户/群/频道 ID"
                value={this.peerIdInput}
                onInput={this.handlePeerIdChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                topicId（群/频道话题）
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="如 42"
                value={this.topicIdInput}
                onInput={this.handleTopicIdChange}
              />
            </View>
            <View className="mb-4">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                threadId（DM 线程）
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="如 99"
                value={this.threadIdInput}
                onInput={this.handleThreadIdChange}
              />
            </View>
            <View className="flex flex-col gap-3 mt-5">
              <Button
                className="w-full h-12 rounded-full text-[17px] font-medium bg-[#00A884] text-white active:bg-[#008F6F]"
                onClick={this.handleSaveSettings}
              >
                保存配置
              </Button>
              {connected ? (
                <Button
                  className="w-full h-12 rounded-full text-[17px] font-medium bg-[#EA868F] text-white active:bg-[#D8747D]"
                  onClick={this.handleDisconnect}
                >
                  断开连接
                </Button>
              ) : (
                <Button
                  className="w-full h-12 rounded-full text-[17px] font-medium bg-[#25D366] text-white active:bg-[#1DA851]"
                  onClick={this.handleConnect}
                >
                  连接服务器
                </Button>
              )}
            </View>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-4">
              数据管理
            </Text>
            <View className="flex justify-between items-center p-3.5 bg-[#F0F2F5] rounded-xl mb-3">
              <Text className="text-[15px] text-[#667781]">聊天消息数量</Text>
              <Text className="text-[17px] font-semibold text-[#111B21]">
                {messages?.length || 0}
              </Text>
            </View>
            <Button
              className="w-full h-12 rounded-full text-[17px] font-medium border border-[#EA868F] text-[#EA868F]"
              onClick={this.handleClearMessages}
            >
              清空聊天记录
            </Button>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-4">
              其他
            </Text>
            <View className="flex justify-between items-center p-3.5 bg-[#F0F2F5] rounded-xl mb-3">
              <Text className="text-[15px] text-[#667781]">计数器示例</Text>
              <Text className="text-[17px] font-semibold text-[#111B21]">
                {count}
              </Text>
            </View>
            <View className="flex gap-2 mb-3">
              <Button
                className="flex-1 h-10 rounded-full bg-[#F0F2F5] text-[15px] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={() => counterStore.increment()}
              >
                +1
              </Button>
              <Button
                className="flex-1 h-10 rounded-full bg-[#F0F2F5] text-[15px] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={() => counterStore.decrement()}
              >
                -1
              </Button>
              <Button
                className="flex-1 h-10 rounded-full bg-[#F0F2F5] text-[15px] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={() => counterStore.reset()}
              >
                重置
              </Button>
            </View>
            <Button
              className="w-full h-12 rounded-full text-[17px] font-medium bg-[#F0F2F5] text-[#111B21] active:bg-[#E9EDEF]"
              onClick={this.handleAbout}
            >
              关于
            </Button>
          </View>
        </View>
      </View>
    );
  }
}

export default Settings;
