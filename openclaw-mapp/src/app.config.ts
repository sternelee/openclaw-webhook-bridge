export default {
  pages: [
    "pages/welcome/index",
    "pages/chat/index",
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
  tabBar: {
    color: "#999",
    selectedColor: "#1890ff",
    backgroundColor: "#fff",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/welcome/index",
        text: "Welcome",
      },
      {
        pagePath: "pages/chat/index",
        text: "Chat",
      },
      {
        pagePath: "pages/settings/index",
        text: "Settings",
      },
    ],
  },
};
