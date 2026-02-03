/// <reference types="@tarojs/taro" />

declare module "*";
declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.css";
declare module "*.less";
declare module "*.scss";
declare module "*.sass";
declare module "*.styl";

// Extend global JSX namespace for towxml component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      towxml: any;
    }
  }
}

export {};
