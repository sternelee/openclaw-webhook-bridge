import { Component } from 'react'
import { View, Text } from '@tarojs/components'
import './commands.scss'

// 硬编码的 OpenClaw 命令列表（来自 OpenClaw commands-registry.data.ts）
const COMMAND_CATEGORIES = {
  '📊 Status': [
    { name: 'help', description: 'Show available commands.' },
    { name: 'commands', description: 'List all slash commands.' },
    { name: 'status', description: 'Show current status.' },
    { name: 'whoami', description: 'Show your sender id.' },
    { name: 'context', description: 'Explain how context is built and used.', acceptsArgs: true },
  ],
  '🛠️ Tools': [
    { name: 'skill', description: 'Run a skill by name.', acceptsArgs: true },
    { name: 'restart', description: 'Restart OpenClaw.' },
  ],
  '⚙️ Management': [
    { name: 'approve', description: 'Approve or deny exec requests.', acceptsArgs: true },
    { name: 'allowlist', description: 'List/add/remove allowlist entries.', acceptsArgs: true },
    { name: 'activation', description: 'Set group activation mode.' },
    { name: 'send', description: 'Set send policy.' },
    { name: 'subagents', description: 'List/stop/log/info subagent runs for this session.' },
    { name: 'config', description: 'Show or set config values.', acceptsArgs: true },
    { name: 'debug', description: 'Set runtime debug overrides.', acceptsArgs: true },
  ],
  '🎯 Options': [
    { name: 'usage', description: 'Usage footer or cost summary.' },
    { name: 'think', description: 'Set thinking level.' },
    { name: 'verbose', description: 'Toggle verbose mode.' },
    { name: 'reasoning', description: 'Toggle reasoning visibility.' },
    { name: 'elevated', description: 'Toggle elevated mode.' },
    { name: 'exec', description: 'Set exec defaults for this session.', acceptsArgs: true },
    { name: 'model', description: 'Show or set the model.' },
    { name: 'models', description: 'List model providers or provider models.', acceptsArgs: true },
    { name: 'queue', description: 'Adjust queue settings.', acceptsArgs: true },
  ],
  '🎙️ Media': [
    { name: 'tts', description: 'Control text-to-speech (TTS).' },
  ],
  '💾 Session': [
    { name: 'stop', description: 'Stop the current run.' },
    { name: 'reset', description: 'Reset the current session.', acceptsArgs: true },
    { name: 'new', description: 'Start a new session.', acceptsArgs: true },
  ],
}

// 硬编码的 OpenClaw 技能列表（常用技能）
const SKILLS = [
  { name: 'web-search', description: 'Search the web for information' },
  { name: 'read-file', description: 'Read and analyze file contents' },
  { name: 'write-file', description: 'Create or modify files' },
  { name: 'bash', description: 'Execute shell commands' },
  { name: 'ask-human', description: 'Ask the user for clarification' },
]

interface Command {
  name: string
  description: string
  acceptsArgs?: boolean
}

interface Skill {
  name: string
  description: string
}

interface Props {
  onCommandSelect: (command: string) => void
  onClose: () => void
}

interface State {
  activeTab: 'commands' | 'skills'
  searchQuery: string
}

export default class CommandPanel extends Component<Props, State> {
  state: State = {
    activeTab: 'commands',
    searchQuery: ''
  }

  handleCommandClick = (command: Command) => {
    const { onCommandSelect } = this.props
    if (command.acceptsArgs) {
      // 对于需要参数的命令，显示提示
      onCommandSelect(`/${command.name} `)
    } else {
      onCommandSelect(`/${command.name}`)
    }
  }

  handleSkillClick = (skill: Skill) => {
    const { onCommandSelect } = this.props
    onCommandSelect(`/skill ${skill.name}`)
  }

  switchTab = (tab: 'commands' | 'skills') => {
    this.setState({ activeTab: tab, searchQuery: '' })
  }

  handleSearchChange = (e: any) => {
    this.setState({ searchQuery: e.detail.value })
  }

  getFilteredCommands = () => {
    const { searchQuery } = this.state
    if (!searchQuery.trim()) {
      return COMMAND_CATEGORIES
    }

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, Command[]> = {}

    Object.entries(COMMAND_CATEGORIES).forEach(([category, commands]) => {
      const filteredCmds = commands.filter((cmd: Command) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      )
      if (filteredCmds.length > 0) {
        filtered[category] = filteredCmds
      }
    })

    return filtered
  }

  getFilteredSkills = () => {
    const { searchQuery } = this.state
    if (!searchQuery.trim()) {
      return SKILLS
    }

    const query = searchQuery.toLowerCase()
    return SKILLS.filter(skill =>
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    )
  }

  render() {
    const { onClose } = this.props
    const { activeTab, searchQuery } = this.state
    const filteredCommands = this.getFilteredCommands()
    const filteredSkills = this.getFilteredSkills()
    const hasCommands = Object.keys(filteredCommands).length > 0
    const hasSkills = filteredSkills.length > 0

    return (
      <View className='command-panel-overlay' onClick={onClose}>
        <View className='command-panel' onClick={(e) => e.stopPropagation()}>
          <View className='panel-header'>
            <Text className='panel-title'>Commands & Skills</Text>
            <View className='close-btn' onClick={onClose}>
              <Text>✕</Text>
            </View>
          </View>

          {/* 搜索框 */}
          <View className='search-box'>
            <input
              type='text'
              value={searchQuery}
              onInput={this.handleSearchChange}
              placeholder='搜索命令或技能...'
              className='search-input'
            />
          </View>

          <View className='tabs'>
            <View
              className={`tab ${activeTab === 'commands' ? 'active' : ''}`}
              onClick={() => this.switchTab('commands')}
            >
              <Text>Commands</Text>
            </View>
            <View
              className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
              onClick={() => this.switchTab('skills')}
            >
              <Text>Skills</Text>
            </View>
          </View>

          {activeTab === 'commands' && (
            <View className='commands-list'>
              {hasCommands ? (
                Object.entries(filteredCommands).map(([category, cmds]) => (
                  <View key={category} className='category'>
                    <View className='category-title'>
                      <Text>{category}</Text>
                    </View>
                    {cmds.map(cmd => (
                      <View
                        key={cmd.name}
                        className='command-item'
                        onClick={() => this.handleCommandClick(cmd)}
                      >
                        <View className='command-name'>
                          <Text>/{cmd.name}</Text>
                        </View>
                        <View className='command-desc'>
                          <Text>{cmd.description}</Text>
                        </View>
                        {cmd.acceptsArgs && (
                          <View className='command-hint'>
                            <Text>需要参数</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View className='empty-state'>
                  <Text className='empty-icon'>🔍</Text>
                  <Text className='empty-text'>未找到匹配的命令</Text>
                  <Text className='empty-hint'>请尝试其他搜索关键词</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'skills' && (
            <View className='skills-list'>
              {hasSkills ? (
                filteredSkills.map(skill => (
                  <View
                    key={skill.name}
                    className='skill-item'
                    onClick={() => this.handleSkillClick(skill)}
                  >
                    <View className='skill-icon'>
                      <Text>🔧</Text>
                    </View>
                    <View className='skill-content'>
                      <View className='skill-name'>
                        <Text>{skill.name}</Text>
                      </View>
                      <View className='skill-desc'>
                        <Text>{skill.description}</Text>
                      </View>
                      <View className='skill-usage'>
                        <Text>/skill {skill.name}</Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View className='empty-state'>
                  <Text className='empty-icon'>🔍</Text>
                  <Text className='empty-text'>未找到匹配的技能</Text>
                  <Text className='empty-hint'>请尝试其他搜索关键词</Text>
                </View>
              )}
            </View>
          )}

          {/* 使用提示 */}
          <View className='usage-hint'>
            <Text>💡 点击命令或技能直接发送到 OpenClaw</Text>
          </View>
        </View>
      </View>
    )
  }
}
