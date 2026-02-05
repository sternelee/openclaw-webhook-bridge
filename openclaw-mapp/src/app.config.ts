export default {
  pages: ["pages/chat/index"],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#ECE5DD",
    navigationBarTitleText: "",
    navigationBarTextStyle: "black",
    navigationStyle: "custom", // 使用自定义导航栏，实现胶囊形态
  },
  usingComponents: {
    towxml: "./components/towxml-build/towxml",
  },
};
