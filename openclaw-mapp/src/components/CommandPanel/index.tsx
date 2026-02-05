import { Component } from 'react'
import { View, Text } from '@tarojs/components'
import './commands.scss'

// OpenClaw 命令和技能列表
const COMMANDS = [
  // Status
  { command: '/help', description: 'Show available commands' },
  { command: '/commands', description: 'List all slash commands' },
  { command: '/status', description: 'Show current status' },
  { command: '/whoami', description: 'Show your sender id' },

  // Session
  { command: '/new', description: 'Start a new session' },
  { command: '/reset', description: 'Reset the current session' },
  { command: '/stop', description: 'Stop the current run' },

  // Options
  { command: '/think', description: 'Set thinking level' },
  { command: '/verbose', description: 'Toggle verbose mode' },
  { command: '/reasoning', description: 'Toggle reasoning visibility' },
  { command: '/elevated', description: 'Toggle elevated mode' },
  { command: '/model', description: 'Show or set the model' },
  { command: '/models', description: 'List model providers' },
  { command: '/usage', description: 'Usage footer or cost summary' },

  // Tools
  { command: '/skill', description: 'Run a skill by name', acceptsArgs: true },
  { command: '/skill web-search', description: 'Search the web for information' },
  { command: '/skill read-file', description: 'Read and analyze file contents' },
  { command: '/skill write-file', description: 'Create or modify files' },
  { command: '/skill bash', description: 'Execute shell commands' },
  { command: '/restart', description: 'Restart OpenClaw' },

  // Management
  { command: '/approve', description: 'Approve or deny execution requests' },
  { command: '/config', description: 'Show or set config values' },
  { command: '/debug', description: 'Set runtime debug overrides' },
  { command: '/subagents', description: 'List/stop/log/info subagent runs' },
  { command: '/activation', description: 'Set group activation mode' },
  { command: '/send', description: 'Set send policy' },
  { command: '/queue', description: 'Adjust queue settings' },

  // Media
  { command: '/tts', description: 'Control text-to-speech' },

  // Other
  { command: '/context', description: 'Explain how context is built and used' },
  { command: '/allowlist', description: 'List/add/remove allowlist entries' },
  { command: '/exec', description: 'Set exec defaults for this session' },
]

interface Props {
  onCommandSelect: (command: string) => void
  onClose: () => void
  onOpenSettings?: () => void
}

export default class CommandPanel extends Component<Props> {
  handleCommandClick = (item: typeof COMMANDS[0]) => {
    const { onCommandSelect } = this.props
    if (item.acceptsArgs) {
      onCommandSelect(`${item.command} `)
    } else {
      onCommandSelect(item.command)
    }
  }

  render() {
    const { onClose, onOpenSettings } = this.props

    return (
      <View className='command-panel-overlay' onClick={onClose}>
        <View className='command-panel' onClick={(e) => e.stopPropagation()}>
          <View className='panel-header'>
            <Text className='panel-title'>Commands</Text>
            <View className='close-btn' onClick={onClose}>
              <Text>✕</Text>
            </View>
          </View>

          <View className='commands-list'>
            {/* Settings - First Item */}
            {onOpenSettings && (
              <View className='command-item command-item-settings' onClick={onOpenSettings}>
                <Text className='command-desc'>Settings</Text>
                <Text className='command-icon'>⚙️</Text>
              </View>
            )}

            {COMMANDS.map((item, index) => (
              <View
                key={index}
                className='command-item'
                onClick={() => this.handleCommandClick(item)}
              >
                <Text className='command-desc'>{item.description}</Text>
                <Text className='command-text'>{item.command}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    )
  }
}
