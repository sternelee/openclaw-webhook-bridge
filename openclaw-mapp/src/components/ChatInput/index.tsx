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
      maxLength = 1000,
    } = this.props;
    const canSend = value.trim().length > 0 && !disabled;

    return (
      <View className="flex items-end px-3 pb-3 pt-2 bg-white border-t border-[#E9EDEF] relative z-10">
        <View className="flex items-end gap-2 w-full">
          {/* Attachment button */}
          {onAttachment && (
            <View
              className={`w-11 h-11 rounded-full flex items-center justify-center text-[#8696A0] ${
                disabled ? "opacity-50" : "active:bg-[#F0F2F5]"
              }`}
              onClick={disabled ? undefined : onAttachment}
            >
              <Text className="text-[18px]">📎</Text>
            </View>
          )}

          {/* Text input */}
          <View className="flex-1 flex flex-col bg-[#F0F2F5] rounded-full px-4 py-2 relative">
            <Input
              className="w-full text-[16px] leading-[1.4] text-[#111B21] bg-transparent"
              type="text"
              placeholder={placeholder}
              value={value}
              maxlength={maxLength}
              disabled={disabled}
              onInput={(e) => onInput(e.detail.value)}
              confirmType="send"
              onConfirm={canSend ? onSend : undefined}
            />
            <Text className="text-[11px] text-[#8696A0] self-end absolute bottom-0 right-4">
              {value.length}/{maxLength}
            </Text>
          </View>

          {/* Voice button when input is empty */}
          {onVoice && value.trim().length === 0 && !disabled && (
            <View
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#8696A0] active:bg-[#F0F2F5]"
              onClick={onVoice}
            >
              <Text className="text-[18px]">🎤</Text>
            </View>
          )}

          {/* Send button */}
          <View
            className={`w-11 h-11 rounded-full flex items-center justify-center ${
              canSend
                ? "bg-[#00A884] text-white active:bg-[#008F6F]"
                : "bg-[#F0F2F5] text-[#8696A0] active:bg-[#E9EDEF]"
            }`}
            onClick={canSend ? onSend : undefined}
          >
            <Text className="text-[28px] -rotate-45">➤</Text>
          </View>
        </View>
      </View>
    );
  }
}

export default ChatInput;
