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
      <View className="flex flex-col px-2 pb-3 pt-2 input-frosted relative z-10">
        <View className="flex items-end gap-2 w-full">
          {/* Command button */}
          {onCommandClick && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[#262a35] active:bg-[#3f3f46] transition-colors border border-[#27272a]"
              onClick={onCommandClick}
            >
              <Text className="text-[18px] oc-text-strong">≡</Text>
            </View>
          )}

          {/* Voice button */}
          {onVoice && !disabled && (
            <View
              className="w-9 h-9 rounded-full flex items-center justify-center oc-text active:bg-[#262a35] transition-colors"
              onClick={onVoice}
            >
              <Text className="text-[18px]">🎤</Text>
            </View>
          )}

          {/* Text input container */}
          <View className="flex-1 flex flex-col bg-[#1a1d25] rounded-[20px] px-3 py-1.5 shadow-sm border border-[#27272a]">
            <Input
              className="w-full min-h-[20px] text-[15px] oc-text bg-transparent"
              type="text"
              placeholder={placeholder}
              placeholderClass="tw-placeholder"
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
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[#ff5c5c] active:bg-[#ff7070] transition-all"
              onClick={onSend}
            >
              <Text className="text-white text-[16px] ml-0.5">➤</Text>
            </View>
          ) : (
            <View
              className={`w-9 h-9 rounded-full flex items-center justify-center oc-text transition-colors ${
                disabled ? "opacity-30" : "active:bg-[#262a35]"
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
