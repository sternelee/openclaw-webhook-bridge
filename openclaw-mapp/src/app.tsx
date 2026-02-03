import { Component } from 'react'
import { Provider } from 'mobx-react'
import './app.scss'
import { chatStore, counterStore } from './store'

class App extends Component {
  render() {
    return (
      <Provider chatStore={chatStore} counterStore={counterStore}>
        {this.props.children}
      </Provider>
    )
  }
}

export default App
