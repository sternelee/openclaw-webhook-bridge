import { Component } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import './commands.scss'

interface Command {
  name: string
  description: string
  category?: string
}

interface Skill {
  name: string
  description: string
  command?: string
}

interface Props {
  onCommandSelect: (command: string) => void
  onClose: () => void
  chatStore?: any
}

interface State {
  commands: Command[]
  skills: Skill[]
  loading: boolean
  activeTab: 'commands' | 'skills'
  responseWaiting: boolean
  responseData: string
}

export default class CommandPanel extends Component<Props, State> {
  state: State = {
    commands: [],
    skills: [],
    loading: false,
    activeTab: 'commands',
    responseWaiting: false,
    responseData: ''
  }

  private responseTimeout: any = null
  private wsMessageHandler: any = null

  componentDidMount() {
    this.setupWebSocketListener()
    this.fetchCommands()
    this.fetchSkills()
  }

  componentWillUnmount() {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout)
    }
    if (this.wsMessageHandler && this.props.chatStore) {
      // Remove WebSocket message handler if needed
    }
  }

  setupWebSocketListener = () => {
    // Listen for command responses from WebSocket
    const { chatStore } = this.props
    if (!chatStore) return

    // Store original onMessage handler to restore later
    this.wsMessageHandler = (data: any) => {
      if (this.state.responseWaiting && data.type === 'complete') {
        this.setState({ 
          responseData: data.content,
          responseWaiting: false 
        })
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout)
          this.responseTimeout = null
        }
      }
    }
  }

  fetchCommands = async () => {
    this.setState({ loading: true })
    try {
      const { chatStore } = this.props
      if (!chatStore || !chatStore.connected) {
        Taro.showToast({
          title: '请先连接服务器',
          icon: 'none'
        })
        return
      }

      // 发送 /commands 指令到后端
      const response = await this.sendCommand('/commands')
      // 解析返回的命令列表
      const commands = this.parseCommandsResponse(response)
      this.setState({ commands })
      
      if (commands.length === 0) {
        Taro.showToast({
          title: '未找到可用命令',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('Failed to fetch commands:', error)
      Taro.showToast({
        title: '获取命令列表失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setState({ loading: false })
    }
  }

  fetchSkills = async () => {
    this.setState({ loading: true })
    try {
      const { chatStore } = this.props
      if (!chatStore || !chatStore.connected) {
        Taro.showToast({
          title: '请先连接服务器',
          icon: 'none'
        })
        return
      }

      // 发送 /skill 指令到后端
      const response = await this.sendCommand('/skill')
      // 解析返回的 skills 列表
      const skills = this.parseSkillsResponse(response)
      this.setState({ skills })
      
      if (skills.length === 0) {
        Taro.showToast({
          title: '未找到可用技能',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('Failed to fetch skills:', error)
      Taro.showToast({
        title: '获取技能列表失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setState({ loading: false })
    }
  }

  sendCommand = async (command: string): Promise<string> => {
    const { chatStore } = this.props
    
    if (!chatStore || !chatStore.connected) {
      throw new Error('Not connected to server')
    }

    return new Promise((resolve, reject) => {
      this.setState({ responseWaiting: true, responseData: '' })
      
      // Set timeout for response
      this.responseTimeout = setTimeout(() => {
        this.setState({ responseWaiting: false })
        reject(new Error('Command timeout'))
      }, 5000)

      // Send command through WebSocket
      chatStore.sendMessage(command)
        .then(() => {
          // Wait for response through wsMessageHandler
          const checkResponse = setInterval(() => {
            if (!this.state.responseWaiting && this.state.responseData) {
              clearInterval(checkResponse)
              resolve(this.state.responseData)
            }
          }, 100)
          
          // Clear check interval after 5 seconds
          setTimeout(() => clearInterval(checkResponse), 5000)
        })
        .catch((error: Error) => {
          if (this.responseTimeout) {
            clearTimeout(this.responseTimeout)
          }
          this.setState({ responseWaiting: false })
          reject(error)
        })
    })
  }

  parseCommandsResponse = (response: string): Command[] => {
    // 简单解析 Markdown 格式的命令列表
    const lines = response.split('\n')
    const commands: Command[] = []
    let currentCategory = ''

    for (const line of lines) {
      // 检测分类标题 (如 **📊 Status**)
      const categoryMatch = line.match(/\*\*(.+?)\*\*/)
      if (categoryMatch) {
        currentCategory = categoryMatch[1]
        continue
      }

      // 检测命令行 (如   /help - Show available commands.)
      const commandMatch = line.match(/^\s*\/(\S+)\s*-\s*(.+)$/)
      if (commandMatch) {
        commands.push({
          name: commandMatch[1],
          description: commandMatch[2],
          category: currentCategory
        })
      }
    }

    return commands
  }

  parseSkillsResponse = (response: string): Skill[] => {
    // 简单解析 Skills 列表
    const skills: Skill[] = []
    const skillBlocks = response.split('🔧 **')

    for (const block of skillBlocks) {
      if (!block.trim()) continue

      const lines = block.split('\n')
      const nameMatch = lines[0]?.match(/^(.+?)\*\*/)
      if (!nameMatch) continue

      const name = nameMatch[1].trim()
      const description = lines[1]?.trim() || ''
      const usageMatch = lines[2]?.match(/\`\/skill\s+(\S+)/)
      const command = usageMatch ? usageMatch[1] : name

      skills.push({ name, description, command })
    }

    return skills
  }

  handleCommandClick = (command: string) => {
    const { onCommandSelect } = this.props
    onCommandSelect(`/${command}`)
  }

  handleSkillClick = (skill: Skill) => {
    const { onCommandSelect } = this.props
    const command = skill.command || skill.name
    // 使用 /skill 命令运行
    onCommandSelect(`/skill ${command}`)
  }

  switchTab = (tab: 'commands' | 'skills') => {
    this.setState({ activeTab: tab })
  }

  render() {
    const { onClose } = this.props
    const { commands, skills, loading, activeTab } = this.state

    // 按分类分组命令
    const groupedCommands: Record<string, Command[]> = {}
    commands.forEach(cmd => {
      const category = cmd.category || 'General'
      if (!groupedCommands[category]) {
        groupedCommands[category] = []
      }
      groupedCommands[category].push(cmd)
    })

    return (
      <View className='command-panel-overlay' onClick={onClose}>
        <View className='command-panel' onClick={(e) => e.stopPropagation()}>
          <View className='panel-header'>
            <Text className='panel-title'>Commands & Skills</Text>
            <View className='close-btn' onClick={onClose}>
              <Text>✕</Text>
            </View>
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

          {loading && (
            <View className='loading'>
              <Text>Loading...</Text>
            </View>
          )}

          {activeTab === 'commands' && !loading && (
            <View className='commands-list'>
              {Object.keys(groupedCommands).length > 0 ? (
                Object.entries(groupedCommands).map(([category, cmds]) => (
                  <View key={category} className='category'>
                    <View className='category-title'>
                      <Text>{category}</Text>
                    </View>
                    {cmds.map(cmd => (
                      <View
                        key={cmd.name}
                        className='command-item'
                        onClick={() => this.handleCommandClick(cmd.name)}
                      >
                        <View className='command-name'>
                          <Text>/{cmd.name}</Text>
                        </View>
                        <View className='command-desc'>
                          <Text>{cmd.description}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View className='empty-state'>
                  <Text className='empty-icon'>📋</Text>
                  <Text className='empty-text'>暂无可用命令</Text>
                  <Text className='empty-hint'>请检查服务器连接</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'skills' && !loading && (
            <View className='skills-list'>
              {skills.length > 0 ? (
                skills.map(skill => (
                  <View
                    key={skill.name}
                    className='skill-item'
                    onClick={() => this.handleSkillClick(skill)}
                  >
                    <View className='skill-name'>
                      <Text>🔧 {skill.name}</Text>
                    </View>
                    <View className='skill-desc'>
                      <Text>{skill.description}</Text>
                    </View>
                    <View className='skill-usage'>
                      <Text>/skill {skill.command || skill.name}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className='empty-state'>
                  <Text className='empty-icon'>🔧</Text>
                  <Text className='empty-text'>暂无可用技能</Text>
                  <Text className='empty-hint'>请检查服务器连接</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    )
  }
}
