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
  tabBar: {
    color: "#999",
    selectedColor: "#1890ff",
    backgroundColor: "#fff",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/welcome/index",
        text: "Welcome",
        iconPath: "assets/icons/welcome.png",
        selectedIconPath: "assets/icons/welcome-active.png",
      },
      {
        pagePath: "pages/chat/index",
        text: "Chat",
        iconPath: "assets/icons/chat.png",
        selectedIconPath: "assets/icons/chat-active.png",
      },
      {
        pagePath: "pages/settings/index",
        text: "Settings",
        iconPath: "assets/icons/settings.png",
        selectedIconPath: "assets/icons/settings-active.png",
      },
    ],
  },
};
