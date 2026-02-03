import { Component } from "react";
import { View, Text, Button } from "@tarojs/components";
import { observer, inject } from "mobx-react";
import "./index.scss";

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
      <View className="index-page">
        <View className="index-container">
          <View className="counter-card">
            <Text className="counter-title">计数器示例</Text>
            <Text className="counter-value">{count}</Text>
            <View className="counter-actions">
              <Button className="counter-btn" onClick={this.handleClick}>
                加一
              </Button>
              <Button className="counter-btn" onClick={this.handleDecrement}>
                减一
              </Button>
              <Button className="counter-btn reset" onClick={this.handleReset}>
                重置
              </Button>
            </View>
          </View>

          <View className="info-card">
            <Text className="info-title">欢迎使用 OpenClaw</Text>
            <Text className="info-desc">
              这是一个基于 Taro + React + MobX 开发的微信小程序示例项目
            </Text>
            <View className="feature-list">
              <View className="feature-item">
                <Text className="feature-dot">•</Text>
                <Text className="feature-text">MobX 状态管理</Text>
              </View>
              <View className="feature-item">
                <Text className="feature-dot">•</Text>
                <Text className="feature-text">WebSocket 实时通信</Text>
              </View>
              <View className="feature-item">
                <Text className="feature-dot">•</Text>
                <Text className="feature-text">本地数据持久化</Text>
              </View>
              <View className="feature-item">
                <Text className="feature-dot">•</Text>
                <Text className="feature-text">响应式 UI 设计</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

export default Index;
