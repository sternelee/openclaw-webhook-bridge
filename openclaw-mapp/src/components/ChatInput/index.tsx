import { Component } from "react";
import { View, Input, Text } from "@tarojs/components";

interface ChatInputProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachment?: () => void;
  onVoice?: () => void;
  onCommandClick?: () => void;
  maxLength?: number;
}

class ChatInput extends Component<ChatInputProps> {
  render() {
    const {
      value,
      placeholder = "输入消息...",
      disabled,
      onInput,
      onSend,
      onAttachment,
      onVoice,
      onCommandClick,
      maxLength = 1000,
    } = this.props;
    const canSend = value.trim().length > 0 && !disabled;

    return (
      <View className="flex flex-col px-2 pb-3 pt-2 bg-[#F0F2F5] relative z-10">
        <View className="flex items-end gap-2 w-full">
          {/* Command button */}
          {onCommandClick && !disabled && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#54656F] active:bg-[#D1D7DB] transition-colors"
              onClick={onCommandClick}
            >
              <Text className="text-[18px]">/</Text>
            </View>
          )}

          {/* Voice button */}
          {onVoice && !disabled && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#54656F] active:bg-[#D1D7DB] transition-colors"
              onClick={onVoice}
            >
              <Text className="text-[18px]">🎤</Text>
            </View>
          )}

          {/* Text input container */}
          <View className="flex-1 flex flex-col bg-white rounded-[20px] px-3 py-1.5 shadow-sm">
            <Input
              className="w-full min-h-[20px] text-[15px] text-[#111B21] bg-transparent"
              type="text"
              placeholder={placeholder}
              placeholderClass="text-[#8696A0]"
              value={value}
              maxlength={maxLength}
              disabled={disabled}
              onInput={(e) => onInput(e.detail.value)}
              confirmType="send"
              onConfirm={canSend ? onSend : undefined}
              adjustPosition
              cursorSpacing={20}
            />
          </View>

          {/* Send or Attachment button */}
          {canSend ? (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[#00A884] active:bg-[#008F6F] transition-all"
              onClick={onSend}
            >
              <Text className="text-white text-[16px] ml-0.5">➤</Text>
            </View>
          ) : (
            <View
              className={`w-9 h-9 rounded-full flex items-center justify-center text-[#54656F] transition-colors ${
                disabled ? "opacity-30" : "active:bg-[#D1D7DB]"
              }`}
              onClick={disabled ? undefined : onAttachment}
            >
              <Text className="text-[20px]">{onAttachment ? "⊕" : "😊"}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
}

export default ChatInput;
