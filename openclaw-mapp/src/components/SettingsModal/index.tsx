import { Component } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

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
      <View className="settings-modal-overlay" onClick={onClose}>
        <View className="settings-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="modal-header">
            <Text className="modal-title">设置</Text>
            <View className="modal-close" onClick={onClose}>
              <Text className="close-icon">×</Text>
            </View>
          </View>

          {/* Content */}
          <View className="modal-content">
            <View className="form-group">
              <Text className="form-label">WebSocket 服务器地址 *</Text>
              <Input
                className="form-input"
                placeholder="wss://your-server.com/ws"
                value={inputUrl}
                onInput={this.handleUrlChange}
                placeholderClass="input-placeholder"
              />
              <Text className="form-hint">
                输入您的 WebSocket 服务器地址，例如: wss://example.com/ws
              </Text>
            </View>

            <View className="form-group">
              <Text className="form-label">UID *</Text>
              <Input
                className="form-input"
                placeholder="输入您的 UID"
                value={inputUid}
                onInput={this.handleUidChange}
                placeholderClass="input-placeholder"
              />
              <Text className="form-hint">
                用于标识用户身份，服务器将根据 UID 路由消息
              </Text>
            </View>

            <View className="info-section">
              <Text className="info-title">说明</Text>
              <View className="info-list">
                <View className="info-item">
                  <Text className="info-dot">•</Text>
                  <Text className="info-text">修改地址后将重新连接服务器</Text>
                </View>
                <View className="info-item">
                  <Text className="info-dot">•</Text>
                  <Text className="info-text">支持 ws:// 和 wss:// 协议</Text>
                </View>
                <View className="info-item">
                  <Text className="info-dot">•</Text>
                  <Text className="info-text">UID 用于服务器路由消息到指定客户端</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View className="modal-footer">
            <Button className="modal-btn secondary" onClick={this.handleClear}>
              清空
            </Button>
            <Button className="modal-btn primary" onClick={this.handleSave}>
              保存
            </Button>
          </View>
        </View>
      </View>
    );
  }
}

export default SettingsModal;
