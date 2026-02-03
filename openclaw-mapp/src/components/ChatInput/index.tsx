import { Component } from "react";
import { View, Input, Text } from "@tarojs/components";
import "./index.scss";

interface ChatInputProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachment?: () => void;
  onVoice?: () => void;
  maxLength?: number;
}

class ChatInput extends Component<ChatInputProps> {
  state = {
    focused: false,
  };

  handleFocus = () => {
    this.setState({ focused: true });
  };

  handleBlur = () => {
    this.setState({ focused: false });
  };

  render() {
    const {
      value,
      placeholder = "输入消息...",
      disabled,
      onInput,
      onSend,
      onAttachment,
      onVoice,
      maxLength = 1000,
    } = this.props;
    const { focused } = this.state;

    const canSend = value.trim().length > 0 && !disabled;

    return (
      <View className={`chat-input-wrapper ${focused ? "focused" : ""}`}>
        <View className="chat-input-container">
          {/* Attachment button */}
          {onAttachment && (
            <View
              className={`input-action-btn attachment ${disabled ? "disabled" : ""}`}
              onClick={disabled ? undefined : onAttachment}
            >
              <Text className="action-icon">📎</Text>
            </View>
          )}

          {/* Text input */}
          <View className="input-field-wrapper">
            <Input
              className="input-field"
              type="text"
              placeholder={placeholder}
              value={value}
              maxlength={maxLength}
              disabled={disabled}
              onInput={(e) => onInput(e.detail.value)}
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              confirmType="send"
              onConfirm={canSend ? onSend : undefined}
            />
            <Text className="char-count">
              {value.length}/{maxLength}
            </Text>
          </View>

          {/* Voice button when input is empty */}
          {onVoice && value.trim().length === 0 && !disabled && (
            <View className="input-action-btn voice" onClick={onVoice}>
              <Text className="action-icon">🎤</Text>
            </View>
          )}

          {/* Send button */}
          <View
            className={`send-btn ${canSend ? "active" : ""}`}
            onClick={canSend ? onSend : undefined}
          >
            <Text className={`send-icon ${canSend ? "active" : ""}`}>
              {canSend ? "➤" : "➤"}
            </Text>
          </View>
        </View>
      </View>
    );
  }
}

export default ChatInput;
