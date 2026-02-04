import { Component } from "react";
import { View, Text, Button } from "@tarojs/components";
import { observer, inject } from "mobx-react";

interface IndexProps {
  counterStore?: any;
}

@inject("counterStore")
@observer
class Index extends Component<IndexProps> {
  handleClick = () => {
    const { counterStore } = this.props;
    counterStore.increment();
  };

  handleDecrement = () => {
    const { counterStore } = this.props;
    counterStore.decrement();
  };

  handleReset = () => {
    const { counterStore } = this.props;
    counterStore.reset();
  };

  render() {
    const { counterStore } = this.props;
    const { count } = counterStore || {};

    return (
      <View className="min-h-screen bg-[#E5DDD5] p-4 box-border">
        <View className="flex flex-col gap-4">
          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-2">
              计数器示例
            </Text>
            <Text className="block text-[32px] font-semibold text-[#00A884] mb-4">
              {count}
            </Text>
            <View className="flex gap-2">
              <Button
                className="flex-1 h-10 rounded-full bg-[#F0F2F5] text-[15px] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={this.handleClick}
              >
                加一
              </Button>
              <Button
                className="flex-1 h-10 rounded-full bg-[#F0F2F5] text-[15px] text-[#111B21] active:bg-[#E9EDEF]"
                onClick={this.handleDecrement}
              >
                减一
              </Button>
              <Button
                className="flex-1 h-10 rounded-full bg-[#EA868F] text-[15px] text-white active:bg-[#D8747D]"
                onClick={this.handleReset}
              >
                重置
              </Button>
            </View>
          </View>

          <View className="bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <Text className="block text-[18px] font-semibold text-[#111B21] mb-2">
              欢迎使用 OpenClaw
            </Text>
            <Text className="text-[14px] text-[#667781] mb-4">
              这是一个基于 Taro + React + MobX 开发的微信小程序示例项目
            </Text>
            <View className="flex flex-col gap-2">
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  MobX 状态管理
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  WebSocket 实时通信
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  本地数据持久化
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="text-[14px] text-[#00A884] leading-[1.4]">•</Text>
                <Text className="flex-1 text-[14px] text-[#667781] leading-[1.4]">
                  响应式 UI 设计
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

export default Index;
