import { Component } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { observer, inject } from "mobx-react";

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
      <View className="min-h-screen bg-[#E5DDD5] p-6 box-border">
        <View className="flex flex-col gap-6">
          <View className="flex flex-col items-center gap-2 pt-6">
            <Text className="text-[32px] font-semibold text-[#111B21]">
              OpenClaw
            </Text>
            <Text className="text-[16px] text-[#667781]">AI Assistant</Text>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-2">
              设置服务器
            </Text>
            <Text className="text-[14px] text-[#667781] mb-4">
              请输入 WebSocket 服务器地址以连接到 OpenClaw 服务
            </Text>

            <View className="mb-5">
              <Text className="block text-[15px] text-[#667781] mb-2 font-medium">
                WebSocket 地址
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                type="text"
                placeholder="wss://your-server.com/ws"
                value={this.wsUrlInput || wsUrl || ""}
                onInput={this.handleInputChange}
              />
            </View>

            <View className="flex flex-col gap-3">
              <Button
                className="w-full h-12 rounded-full text-[17px] font-medium bg-[#00A884] text-white active:bg-[#008F6F]"
                onClick={this.handleConnect}
              >
                连接服务器
              </Button>
              <Button
                className="w-full h-12 rounded-full text-[17px] font-medium bg-[#F0F2F5] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={this.handleSkip}
              >
                跳过，稍后设置
              </Button>
            </View>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-3">
              使用说明
            </Text>
            <View className="flex flex-col gap-2">
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  首次使用需要配置 WebSocket 服务器地址
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  配置后可在"设置"页面修改服务器地址
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  聊天记录会自动保存在本地
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

export default Welcome;
