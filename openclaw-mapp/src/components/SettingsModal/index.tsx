import { Component } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

interface SettingsModalProps {
  visible: boolean;
  wsUrl: string;
  uid: string;
  onClose: () => void;
  onSave: (wsUrl: string, uid: string) => void;
}

interface SettingsModalState {
  inputUrl: string;
  inputUid: string;
}

class SettingsModal extends Component<SettingsModalProps, SettingsModalState> {
  constructor(props: SettingsModalProps) {
    super(props);
    this.state = {
      inputUrl: props.wsUrl || "",
      inputUid: props.uid || "",
    };
  }

  componentWillReceiveProps(nextProps: SettingsModalProps) {
    if (nextProps.wsUrl !== this.props.wsUrl || nextProps.uid !== this.props.uid) {
      this.setState({
        inputUrl: nextProps.wsUrl || "",
        inputUid: nextProps.uid || "",
      });
    }
  }

  handleUrlChange = (e: any) => {
    this.setState({ inputUrl: e.detail.value });
  };

  handleUidChange = (e: any) => {
    this.setState({ inputUid: e.detail.value });
  };

  handleSave = () => {
    const url = this.state.inputUrl.trim();
    const uid = this.state.inputUid.trim();

    if (!url) {
      Taro.showToast({
        title: "请输入服务器地址",
        icon: "none",
      });
      return;
    }

    if (!uid) {
      Taro.showToast({
        title: "请输入 UID",
        icon: "none",
      });
      return;
    }

    // Basic URL validation
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      Taro.showToast({
        title: "请输入有效的 WebSocket 地址",
        icon: "none",
      });
      return;
    }

    this.props.onSave(url, uid);
    this.props.onClose();

    Taro.showToast({
      title: "设置已保存",
      icon: "success",
    });
  };

  handleClear = () => {
    this.setState({ inputUrl: "", inputUid: "" });
  };

  render() {
    const { visible, onClose } = this.props;
    const { inputUrl, inputUid } = this.state;

    if (!visible) return null;

    return (
      <View
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
        onClick={onClose}
      >
        <View
          className="w-[85%] max-w-[400px] bg-white rounded-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#E9EDEF]">
            <Text className="text-[20px] font-semibold text-[#111B21]">设置</Text>
            <View
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F0F2F5] active:bg-[#E9EDEF]"
              onClick={onClose}
            >
              <Text className="text-[24px] text-[#54656F] leading-none">×</Text>
            </View>
          </View>

          {/* Content */}
          <View className="p-5">
            <View className="mb-5">
              <Text className="block text-[15px] text-[#667781] mb-[10px] font-medium">
                WebSocket 服务器地址 *
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                placeholder="wss://your-server.com/ws"
                value={inputUrl}
                onInput={this.handleUrlChange}
                placeholderClass="tw-placeholder"
              />
              <Text className="block text-[13px] text-[#8696A0] mt-2 leading-[1.4]">
                输入您的 WebSocket 服务器地址，例如: wss://example.com/ws
              </Text>
            </View>

            <View className="mb-5">
              <Text className="block text-[15px] text-[#667781] mb-[10px] font-medium">
                UID *
              </Text>
              <Input
                className="w-full h-12 px-[14px] bg-[#F0F2F5] border border-[#E9EDEF] rounded-xl text-[16px] text-[#111B21] box-border"
                placeholder="输入您的 UID"
                value={inputUid}
                onInput={this.handleUidChange}
                placeholderClass="tw-placeholder"
              />
              <Text className="block text-[13px] text-[#8696A0] mt-2 leading-[1.4]">
                用于标识用户身份，服务器将根据 UID 路由消息
              </Text>
            </View>

            <View className="bg-[#F0F2F5] rounded-xl p-3.5 mt-4">
              <Text className="block text-[15px] text-[#111B21] mb-[10px] font-medium">
                说明
              </Text>
              <View className="flex flex-col gap-2">
                <View className="flex items-start gap-2">
                  <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                  <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                    修改地址后将重新连接服务器
                  </Text>
                </View>
                <View className="flex items-start gap-2">
                  <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                  <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                    支持 ws:// 和 wss:// 协议
                  </Text>
                </View>
                <View className="flex items-start gap-2">
                  <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                  <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                    UID 用于服务器路由消息到指定客户端
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View className="flex gap-3 px-5 pb-4 pt-4 border-t border-[#E9EDEF]">
            <Button
              className="flex-1 h-[46px] rounded-full text-[16px] font-medium bg-[#F0F2F5] text-[#111B21] active:bg-[#E9EDEF]"
              onClick={this.handleClear}
            >
              清空
            </Button>
            <Button
              className="flex-1 h-[46px] rounded-full text-[16px] font-medium bg-[#00A884] text-white active:bg-[#008F6F]"
              onClick={this.handleSave}
            >
              保存
            </Button>
          </View>
        </View>
      </View>
    );
  }
}

export default SettingsModal;
