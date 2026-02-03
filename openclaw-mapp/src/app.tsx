import { Component, PropsWithChildren } from "react";
import { Provider } from "mobx-react";
import { chatStore, counterStore } from "./store";
import "./app.scss";

interface AppProps extends PropsWithChildren {}

class App extends Component<AppProps> {
  render() {
    return (
      <Provider chatStore={chatStore} counterStore={counterStore}>
        {this.props.children}
      </Provider>
    );
  }
}

export default App;
