export default {
  pages: [
    "pages/chat/index",
    "pages/welcome/index",
    "pages/settings/index",
    "pages/index/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "OpenClaw",
    navigationBarTextStyle: "black",
  },
  usingComponents: {
    towxml: "./components/towxml-build/towxml",
  },
};
