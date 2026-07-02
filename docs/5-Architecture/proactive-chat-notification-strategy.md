# 白守 AI 主动互动通知策略

> **文档版本**：v1.0.0  
> **最后更新**：2026-06-30  
> **适用平台**：桌面端（Windows + Electron）、移动端（Android + Expo）

---

## 一、概述

### 1.1 功能定位

**AI 主动互动**是白守从"被动响应工具"升级为"主动陪伴伙伴"的关键能力。传统 AI 对话应用中，用户必须主动发起对话，AI 才会响应；而在陪伴场景下，AI 应该能够：

- 在合适的时机主动问候用户（如早晨、晚安）
- 在用户写完日记后主动给予回应
- 在用户长时间未互动时温柔提醒
- 在重要日期（生日、纪念日）主动送上祝福
- 基于日记内容的情感分析，主动关心用户

这不仅是功能增强，更是**情感陪伴体验**的本质升级——就像真实的朋友，不会只在你找 TA 时才出现。

### 1.2 设计原则

白守的主动互动设计遵循以下核心原则：

#### **1.2.1 隐私第一**

- ✅ **完全本地化**：所有主动消息生成逻辑在本地执行，不依赖云端推送服务器
- ✅ **数据不上传**：AI 分析日记、生成提示词的过程完全在用户设备上完成
- ❌ **拒绝 FCM 推送**：不使用 Firebase Cloud Messaging 等需要上传 Token 的远程推送服务

#### **1.2.2 用户可控**

- ✅ **开关自由**：用户可以完全关闭主动互动功能
- ✅ **频率可调**：提供"低频/中频/高频"三档选择
- ✅ **免打扰时段**：支持设置勿扰时间（如 23:00-08:00）
- ✅ **场景可选**：用户可以单独开关"定时问候"、"日记回应"、"长时间静默提醒"等场景

#### **1.2.3 温柔而不打扰**

- ✅ **适度频率**：默认配置下，AI 每天最多主动发起 1-2 次对话
- ✅ **智能避让**：检测用户活跃时段，避免在用户忙碌时打扰
- ✅ **渐进式提醒**：首次使用时降低频率，逐步建立用户信任

#### **1.2.4 技术可靠性**

- ✅ **降级优雅**：即使通知权限被拒绝，应用内提示依然可用
- ✅ **跨平台一致**：桌面端和移动端体验对齐
- ✅ **资源友好**：避免过度消耗电量和系统资源

### 1.3 隐私与用户体验平衡

**核心挑战**：如何在保护隐私的前提下，实现"AI 随时能主动联系用户"？

#### **传统方案的问题**

大多数 AI 应用使用**云端推送**实现主动通知：

1. 用户设备向云端注册推送 Token
2. 云端定时分析用户数据，判断是否需要推送
3. 通过 FCM/APNs 向设备发送推送通知

**这种方案的隐私风险**：

- ❌ 推送 Token 必须上传到服务器
- ❌ 云端必须能够读取用户日记内容（否则无法生成个性化消息）
- ❌ 用户失去对数据的完全控制

#### **白守的解决方案**

**完全本地化的主动触发架构**：

```
触发器引擎（定时/事件监听）
    ↓
检测到触发条件
    ↓
AI 推理引擎读取日记数据库
    ↓
生成主动消息
    ↓
通知系统（Electron / Expo）
    ↓
用户看到通知
```

**关键设计**：

1. **触发器在本地运行**：使用 Node.js 定时器（桌面端）或 Android WorkManager（移动端）
2. **AI 推理在本地完成**：调用用户配置的 AI 模型（Gemini/OpenAI API），提示词在本地生成
3. **通知由系统发出**：使用 Electron Notification API 或 Expo Notifications，无需第三方推送服务

**隐私保证**：

- ✅ 触发逻辑、消息生成、通知发送全流程在本地闭环
- ✅ 唯一的网络请求是调用 AI API（这是用户主动配置的，与现有对话功能一致）
- ✅ 白守服务器不参与任何主动互动流程

---

## 二、通知机制分析

### 2.1 桌面端（Windows + Electron）通知方式

#### **2.1.1 系统通知（Notification API）**

**实现方式**：

```typescript
import { Notification } from 'electron'

const notification = new Notification({
  title: '白守 - Latte',
  body: '你好呀，今天过得怎么样？',
  icon: path.join(__dirname, '../../resources/icon.png'),
  silent: false,
  timeoutType: 'default'
})

notification.on('click', () => {
  mainWindow.show()
  mainWindow.focus()
})

notification.show()
```

**特点**：

- ✅ **原生集成**：调用 Windows 10/11 的 Action Center 通知系统
- ✅ **系统级**：即使应用最小化到托盘，通知依然会弹出
- ✅ **持久化**：通知会保留在 Windows 通知中心，用户可以回看
- ✅ **交互性**：支持点击回调，可以打开应用或跳转到特定页面
- ✅ **无需额外依赖**：Electron 内置

**局限**：

- ⚠️ **样式受限**：只能使用 Windows 系统默认样式
- ⚠️ **内容长度限制**：标题最多 ~50 字符，正文最多 ~200 字符
- ⚠️ **无法嵌入富媒体**：不支持图片预览、按钮
- ⚠️ **需要应用注册**：首次使用需要在 Windows 注册应用 ID

**最佳实践**：

- 标题固定为"白守 - Latte"
- 正文截取前 120 字，超出部分用"..."
- 点击通知后跳转到对应会话页面

---

#### **2.1.2 应用内通知（自定义 Toast）**

**实现方式**：

```typescript
// packages/ui/src/desktop/ProactiveToast/ProactiveToast.tsx
export const ProactiveToast = ({ message, onClose }: Props) => {
  return (
    <div className="proactive-toast">
      <div className="toast-header">
        <img src="/latte-avatar.png" alt="Latte" />
        <span>Latte 有话对你说</span>
        <button onClick={onClose}>×</button>
      </div>
      <div className="toast-body">{message}</div>
      <div className="toast-actions">
        <button onClick={() => openSession()}>立即查看</button>
        <button onClick={onClose}>稍后</button>
      </div>
    </div>
  )
}
```

**特点**：

- ✅ **完全自定义**：可以设计符合白守风格的 UI
- ✅ **富媒体支持**：可以显示 AI 助手头像、按钮、甚至消息预览
- ✅ **无权限限制**：不需要用户授权
- ✅ **即时交互**：可以直接在 Toast 上点击"立即回复"按钮

**局限**：

- ❌ **仅应用内有效**：应用最小化或后台时用户看不到
- ❌ **无持久化**：关闭后就消失
- ❌ **依赖应用焦点**：用户必须在看屏幕且应用在前台

**最佳实践**：

- 显示在应用右上角，不遮挡主要内容
- 5 秒后自动淡出
- 点击"立即查看"跳转到会话页面并自动聚焦输入框

---

#### **2.1.3 托盘图标提示**

**实现方式**：

```typescript
import { Tray } from 'electron'

const tray = new Tray(iconPath)

// 图标闪烁
let isHighlight = false
const flashInterval = setInterval(() => {
  isHighlight = !isHighlight
  tray.setImage(isHighlight ? iconHighlightPath : iconNormalPath)
}, 800)

// 用户点击托盘后停止闪烁
tray.on('click', () => {
  clearInterval(flashInterval)
  tray.setImage(iconNormalPath)
  mainWindow.show()
})
```

**特点**：

- ✅ **低干扰**：只在托盘区域显示，不弹窗
- ✅ **持续提示**：可以通过图标变化持续提醒
- ✅ **节省空间**：不占用屏幕空间

**局限**：

- ⚠️ **可见性差**：用户可能忽略托盘区域
- ⚠️ **无法传递详细信息**：只能显示"有消息"

**最佳实践**：

- 作为辅助提示，配合系统通知使用
- 用户点击托盘图标后，停止闪烁并打开应用

---

#### **2.1.4 窗口闪烁（Window Flash）**

**实现方式**：

```typescript
import { BrowserWindow } from 'electron'

const mainWindow = BrowserWindow.getFocusedWindow()
mainWindow.flashFrame(true)

mainWindow.once('focus', () => {
  mainWindow.flashFrame(false)
})
```

**特点**：

- ✅ **强提醒**：任务栏图标高亮闪烁
- ✅ **系统原生**：Windows 用户熟悉的行为
- ✅ **零干扰**：不弹窗，只在任务栏闪烁

**局限**：

- ❌ **无信息传递**：只能提示"有消息"
- ❌ **需要用户切换**：用户必须主动切到应用

---

#### **2.1.5 桌面端对比与选择**

| 通知方式         | 应用后台可用 | 显示内容   | 持久化 | 交互性     | 适用场景       |
| ---------------- | ------------ | ---------- | ------ | ---------- | -------------- |
| **系统通知**     | ✅           | 标题+正文  | ✅     | ⭐⭐⭐     | **主要通知**   |
| **应用内 Toast** | ❌           | 完全自定义 | ❌     | ⭐⭐⭐⭐⭐ | 应用内实时提示 |
| **托盘闪烁**     | ✅           | 仅图标变化 | ✅     | ⭐         | 辅助提醒       |
| **窗口闪烁**     | ⚠️           | 无         | ❌     | ⭐         | 辅助提醒       |

**推荐策略**：

- **应用最小化/后台** → 系统通知（主） + 托盘闪烁（辅）
- **应用打开但不在对话页** → 应用内 Toast + 消息列表角标
- **应用打开且在对话页** → 直接显示消息气泡 + 轻提示音

---

### 2.2 移动端（Android + Expo）通知方式

#### **2.2.1 本地通知（Local Notifications）**

**实现方式**：

```typescript
import * as Notifications from 'expo-notifications'

// 配置通知处理行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
})

// 发送本地通知
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Latte',
    body: '你好呀，今天过得怎么样？',
    data: { sessionId: 'xxx', assistantId: 'default-latte' },
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH
  },
  trigger: null // 立即显示，或 { seconds: 60 } 延迟
})
```

**特点**：

- ✅ **完全本地**：不依赖网络，不需要后端推送服务器
- ✅ **即时性**：立即触发，延迟可控（毫秒级）
- ✅ **离线可用**：即使没有网络也能工作
- ✅ **丰富的配置**：支持声音、震动、优先级、通知通道

**局限**：

- ⚠️ **应用必须运行**：应用被系统杀死后无法触发（除非用前台服务）
- ⚠️ **电池优化影响**：Android 省电模式可能延迟或阻止通知
- ⚠️ **需要权限**：Android 13+ 需要用户授权通知权限

**权限请求**：

```typescript
// 请求通知权限
const { status: existingStatus } = await Notifications.getPermissionsAsync()
let finalStatus = existingStatus

if (existingStatus !== 'granted') {
  const { status } = await Notifications.requestPermissionsAsync()
  finalStatus = status
}

if (finalStatus !== 'granted') {
  // 降级：仅使用应用内 Toast
  console.warn('通知权限未授予，将使用应用内提示')
}
```

**通知点击处理**：

```typescript
// 监听通知点击
Notifications.addNotificationResponseReceivedListener((response) => {
  const { sessionId, assistantId } = response.notification.request.content.data

  // 跳转到对应会话
  navigation.navigate('AgentChat', { sessionId, assistantId })
})
```

**最佳实践**：

- 标题简短："Latte"或用户自定义助手名称
- 正文截取前 100 字
- 使用 `data` 字段传递会话 ID，点击后直接跳转

---

#### **2.2.2 应用内通知（In-App Toast）**

**实现方式**：

```typescript
// 使用 react-native-toast-message
import Toast from 'react-native-toast-message'

Toast.show({
  type: 'info',
  text1: 'Latte 有话对你说',
  text2: message,
  visibilityTime: 4000,
  autoHide: true,
  onPress: () => {
    navigation.navigate('AgentChat', { sessionId })
  }
})
```

**特点**：

- ✅ **即时显示**：用户在应用内立即看到
- ✅ **完全自定义**：可以设计精美的 UI
- ✅ **无需权限**：不需要通知权限

**局限**：

- ❌ **仅应用内**：用户必须打开应用才能看到
- ❌ **无持久化**：关闭后消失

---

#### **2.2.3 前台服务通知（Foreground Service）**

**实现方式**：

```typescript
import * as TaskManager from 'expo-task-manager'
import * as BackgroundFetch from 'expo-background-fetch'

// 注册后台任务
TaskManager.defineTask('PROACTIVE_CHAT_CHECK', async () => {
  // 每隔 15 分钟检查是否需要主动发消息
  const shouldNotify = await checkProactiveTrigger()

  if (shouldNotify) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Latte',
        body: '好久不见，最近还好吗？'
      },
      trigger: null
    })
  }

  return BackgroundFetch.BackgroundFetchResult.NewData
})

// 注册定时任务
await BackgroundFetch.registerTaskAsync('PROACTIVE_CHAT_CHECK', {
  minimumInterval: 15 * 60, // 15 分钟
  stopOnTerminate: false,
  startOnBoot: true
})
```

**特点**：

- ✅ **应用关闭也能运行**：Android 前台服务不会被杀死
- ✅ **定时任务**：可以实现"每天 9 点主动问候"
- ✅ **本地化**：不需要推送服务器

**局限**：

- ⚠️ **显示持续通知**：前台服务必须显示通知栏图标（如"白守正在运行"）
- ⚠️ **耗电**：长期后台运行会消耗电量
- ⚠️ **复杂度高**：需要处理各种 Android 系统限制（Doze 模式、省电优化）

**前台服务通知**：

```typescript
// 前台服务必须显示持续通知
await Notifications.scheduleNotificationAsync({
  content: {
    title: '白守正在运行',
    body: '点击打开应用',
    priority: Notifications.AndroidNotificationPriority.LOW,
    sticky: true // 不可滑动清除
  },
  trigger: null
})
```

**最佳实践**：

- 仅在用户明确开启"高频主动互动"时启用前台服务
- 提供"停止后台运行"按钮，尊重用户选择
- 在设置中明确说明耗电情况

---

#### **2.2.4 推送通知（FCM）— 不推荐**

**实现方式**：

```typescript
// 使用 Firebase Cloud Messaging
import * as Notifications from 'expo-notifications'

// 获取推送 Token
const { data: token } = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-project-id'
})

// 上传 Token 到服务器（❌ 违背白守隐私理念）
await fetch('https://your-server.com/api/register-token', {
  method: 'POST',
  body: JSON.stringify({ token })
})
```

**为什么不推荐**：

- ❌ **违背隐私原则**：Token 必须上传到服务器
- ❌ **需要后端支持**：必须搭建推送服务器
- ❌ **中国大陆不可用**：FCM 被墙，需要接入厂商推送（小米、华为、OPPO）
- ❌ **增加复杂度**：需要维护服务器、处理 Token 过期、重试逻辑

**唯一适用场景**：

- 如果白守未来提供"云端 AI 伴侣"服务（用户可选），可以使用 FCM
- 但必须在设置中明确标注"云端模式会上传推送 Token"

---

#### **2.2.5 移动端对比与选择**

| 通知方式         | 应用关闭可用 | 需要权限 | 隐私友好 | 耗电 | 适用场景         |
| ---------------- | ------------ | -------- | -------- | ---- | ---------------- |
| **本地通知**     | ⚠️ 应用后台  | ✅       | ✅       | 低   | **主要通知**     |
| **应用内 Toast** | ❌           | ❌       | ✅       | 极低 | 应用内提示       |
| **前台服务**     | ✅           | ✅       | ✅       | 中   | 高频场景（可选） |
| **FCM 推送**     | ✅           | ✅       | ❌       | 低   | **不推荐**       |

**推荐策略**：

- **应用后台** → 本地通知
- **应用打开但不在对话页** → 应用内 Toast + 角标
- **应用打开且在对话页** → 直接显示消息气泡
- **高频主动互动（可选）** → 前台服务 + 用户明确授权

---

### 2.3 Android 系统限制与应对

#### **2.3.1 Doze 模式与省电优化**

**问题**：Android 6.0+ 引入 Doze 模式，息屏后会限制后台任务：

- 网络访问被阻止
- 定时任务延迟执行
- WakeLock 被忽略

**应对方案**：

```typescript
// 1. 引导用户将白守加入电池优化白名单
import * as IntentLauncher from 'expo-intent-launcher'

const openBatterySettings = () => {
  IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
    {
      data: 'package:com.baishou.baishou'
    }
  )
}

// 2. 在设置页面提示
<View>
  <Text>为了让 Latte 能在合适的时机主动联系你，请允许白守在后台运行：</Text>
  <Button onPress={openBatterySettings}>前往设置</Button>
</View>
```

**用户教育文案**：

```
📱 为什么需要后台运行权限？

白守的 AI 伙伴功能需要在合适的时机主动向你问候（如每天早晨），
这需要应用在后台保持轻量运行。

✅ 我们承诺：
- 仅在你开启"主动互动"时运行
- 不会上传任何数据到服务器
- 耗电量极低（每天 < 1% 电量）

你可以随时在设置中关闭此功能。
```

---

#### **2.3.2 厂商省电策略**

**问题**：国内厂商（小米、华为、OPPO、vivo）会激进杀后台：

- 应用被彻底杀死，无法接收本地通知
- 即使加入白名单，也可能在内存不足时被杀

**应对方案**：

1. **检测厂商并提供指引**：

```typescript
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

const getManufacturer = async () => {
  return await DeviceInfo.getManufacturer()
}

const getBackgroundGuide = (manufacturer: string) => {
  const guides = {
    xiaomi: '小米手机：设置 → 应用设置 → 白守 → 省电策略 → 无限制',
    huawei: '华为手机：设置 → 应用 → 白守 → 电池 → 允许后台活动',
    oppo: 'OPPO 手机：设置 → 电池 → 白守 → 允许后台运行',
    vivo: 'vivo 手机：i管家 → 应用管理 → 白守 → 允许自启动'
  }
  return guides[manufacturer.toLowerCase()] || '请在手机设置中允许白守后台运行'
}
```

2. **降级策略**：

```typescript
// 如果检测到应用经常被杀死，降低主动互动频率
const shouldReduceFrequency = async () => {
  const lastCheckTime = await getLastCheckTime()
  const now = Date.now()

  // 如果上次检查距今超过 2 小时（预期是 15 分钟），说明被杀了
  if (now - lastCheckTime > 2 * 60 * 60 * 1000) {
    return true
  }
  return false
}
```

---

#### **2.3.3 通知权限被拒绝**

**应对方案**：

```typescript
const handleNotificationDenied = () => {
  // 降级：仅使用应用内 Toast
  Toast.show({
    type: 'info',
    text1: '通知权限未开启',
    text2: 'Latte 的主动问候将仅在应用内显示',
    visibilityTime: 6000,
    position: 'top'
  })

  // 在设置中提示用户
  await saveSetting('proactive.notificationDenied', true)
}

// 设置页面显示提示
{settings.proactive.notificationDenied && (
  <Banner type="warning">
    开启通知权限后，Latte 能在更多场景下主动联系你。
    <Button onPress={openAppSettings}>前往设置</Button>
  </Banner>
)}
```

---

## 三、主动互动触发策略

### 3.1 触发场景设计

#### **3.1.1 时间触发（定时问候）**

**场景描述**：AI 在特定时间点主动问候用户。

**触发条件**：

```typescript
interface TimeBasedTrigger {
  type: 'time-based'
  schedule: {
    time: string // "09:00" HH:mm 格式
    days: number[] // [1,2,3,4,5] 周一到周五
    timezone: string // 用户时区
  }
  promptTemplate: string
}

// 示例：每天早上 9 点
const morningGreeting: TimeBasedTrigger = {
  type: 'time-based',
  schedule: {
    time: '09:00',
    days: [1, 2, 3, 4, 5, 6, 7], // 每天
    timezone: 'Asia/Shanghai'
  },
  promptTemplate: '现在是早上，请温柔地向用户问候早安，询问今天的计划或心情。'
}
```

**最佳实践**：

- **早晨问候**：09:00 - "早上好，今天有什么计划吗？"
- **午间关怀**：12:30 - "午饭吃了吗？今天过得怎么样？"
- **晚安提醒**：22:00 - "准备休息了吗？今天有什么想记录的吗？"

---

#### **3.1.2 事件触发（日记完成后回应）**

**场景描述**：用户完成日记写作后，AI 主动给予回应。

**触发条件**：

```typescript
interface EventBasedTrigger {
  type: 'event-based'
  event: 'diary-saved' | 'diary-deleted' | 'long-silence'
  condition?: {
    minWordCount?: number // 最少字数
    delay?: number // 延迟触发（秒）
  }
  promptTemplate: string
}

// 示例：日记完成后 30 秒触发
const diaryCompletion: EventBasedTrigger = {
  type: 'event-based',
  event: 'diary-saved',
  condition: {
    minWordCount: 50, // 至少 50 字才触发
    delay: 30 // 30 秒后触发
  },
  promptTemplate: '用户刚写完日记，请阅读最新日记内容并给予温暖的回应。'
}
```

**实现示例**：

```typescript
// packages/core/src/diary/diary.service.ts
export class DiaryService {
  async saveDiary(content: string, date: Date) {
    // 保存日记...

    // 触发事件
    if (content.length >= 50) {
      eventBus.emit('diary-saved', {
        diaryId: diary.id,
        date,
        wordCount: content.length
      })
    }
  }
}

// apps/desktop/src/main/services/proactive-chat.service.ts
eventBus.on('diary-saved', async (event) => {
  // 延迟 30 秒后触发
  setTimeout(async () => {
    await this.executeTrigger({
      type: 'event-based',
      event: 'diary-saved',
      promptTemplate: `用户刚写完日记（${event.wordCount} 字），请阅读并回应。`
    })
  }, 30 * 1000)
})
```

**最佳实践**：

- 延迟触发，避免打断用户正在进行的操作
- 设置最小字数阈值，避免对短日记频繁触发
- 给予真诚的回应，避免机械化的"写得很好"

---

#### **3.1.3 长时间静默提醒**

**场景描述**：用户长时间未使用白守，AI 主动提醒。

**触发条件**：

```typescript
interface SilenceTrigger {
  type: 'silence-detection'
  silenceDuration: number // 静默时长（天）
  maxReminders: number // 最多提醒次数
  reminderInterval: number // 提醒间隔（天）
  promptTemplate: string
}

// 示例：7 天未写日记后提醒
const longSilence: SilenceTrigger = {
  type: 'silence-detection',
  silenceDuration: 7,
  maxReminders: 2, // 最多提醒 2 次
  reminderInterval: 3, // 每 3 天提醒一次
  promptTemplate: '用户已经 7 天没有写日记了，请温柔地提醒他记录生活，但不要有压力。'
}
```

**实现示例**：

```typescript
// 每天检查一次
setInterval(
  async () => {
    const lastDiaryDate = await getLastDiaryDate()
    const daysSince = (Date.now() - lastDiaryDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSince >= 7) {
      const reminderCount = await getReminderCount('silence')

      if (reminderCount < 2) {
        await sendProactiveMessage({
          promptTemplate: '用户已经 7 天没有写日记了，请温柔地关心他。'
        })

        await incrementReminderCount('silence')
      }
    }
  },
  1000 * 60 * 60 * 24
) // 每天检查
```

**最佳实践**：

- 语气温柔，不要让用户有负罪感
- 限制提醒次数，避免过度打扰
- 提供"暂停提醒"选项

---

#### **3.1.4 智能触发（情感分析）**

**场景描述**：基于日记情感分析，主动关心用户。

**触发条件**：

```typescript
interface SentimentTrigger {
  type: 'sentiment-based'
  targetSentiment: 'negative' | 'anxious' | 'sad'
  threshold: number // 情感强度阈值 0-1
  delay: number // 延迟触发（小时）
  promptTemplate: string
}

// 示例：检测到负面情绪后关心
const negativeEmotion: SentimentTrigger = {
  type: 'sentiment-based',
  targetSentiment: 'sad',
  threshold: 0.7, // 悲伤程度 > 0.7
  delay: 2, // 2 小时后触发
  promptTemplate: '用户最近的日记显示情绪低落，请温柔地关心他，但不要过度干预。'
}
```

**实现示例**：

```typescript
// 使用 AI 分析情感
const analyzeSentiment = async (diaryContent: string) => {
  const response = await ai.chat({
    messages: [
      {
        role: 'user',
        content: `分析以下日记的情感：\n${diaryContent}\n\n返回 JSON: { sentiment: "positive" | "negative" | "neutral", score: 0-1 }`
      }
    ]
  })

  return JSON.parse(response.content)
}

// 日记保存后分析
eventBus.on('diary-saved', async (event) => {
  const sentiment = await analyzeSentiment(event.content)

  if (sentiment.sentiment === 'negative' && sentiment.score > 0.7) {
    // 2 小时后触发关心
    setTimeout(
      async () => {
        await sendProactiveMessage({
          promptTemplate: '用户最近情绪低落，请温柔地关心他。'
        })
      },
      2 * 60 * 60 * 1000
    )
  }
})
```

**最佳实践**：

- 不要立即触发，给用户时间消化情绪
- 语气真诚，避免说教
- 尊重用户隐私，不要过度分析

---

### 3.2 触发频率控制

#### **3.2.1 防打扰规则**

**全局频率限制**：

```typescript
interface FrequencyControl {
  maxPerDay: number // 每天最多触发次数
  minInterval: number // 最小触发间隔（小时）
  dndTimeRange: { start: string; end: string } // 免打扰时段
  respectUserActivity: boolean // 是否避让用户活跃时段
}

const defaultFrequency: FrequencyControl = {
  maxPerDay: 2, // 每天最多 2 次
  minInterval: 4, // 至少间隔 4 小时
  dndTimeRange: { start: '23:00', end: '08:00' },
  respectUserActivity: true
}
```

**实现示例**：

```typescript
const canTrigger = async (trigger: Trigger): Promise<boolean> => {
  // 1. 检查今日已触发次数
  const todayCount = await getTodayTriggerCount()
  if (todayCount >= defaultFrequency.maxPerDay) {
    return false
  }

  // 2. 检查最近触发时间
  const lastTriggerTime = await getLastTriggerTime()
  const hoursSince = (Date.now() - lastTriggerTime) / (1000 * 60 * 60)
  if (hoursSince < defaultFrequency.minInterval) {
    return false
  }

  // 3. 检查免打扰时段
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  if (isInDndRange(currentTime, defaultFrequency.dndTimeRange)) {
    return false
  }

  // 4. 检查用户活跃状态
  if (defaultFrequency.respectUserActivity) {
    const isUserActive = await checkUserActivity()
    if (isUserActive) {
      return false // 用户正在使用应用，延后触发
    }
  }

  return true
}
```

---

#### **3.2.2 用户偏好设置**

**设置界面**：

```typescript
interface ProactiveChatSettings {
  enabled: boolean // 总开关
  frequency: 'low' | 'medium' | 'high' // 频率档位
  enabledScenarios: {
    timeBasedGreeting: boolean // 定时问候
    diaryResponse: boolean // 日记回应
    silenceReminder: boolean // 静默提醒
    sentimentCare: boolean // 情感关怀
  }
  dndTimeRange: { start: string; end: string }
  preferredGreetingTime: string // 偏好问候时间
}

// 频率档位映射
const frequencyMapping = {
  low: { maxPerDay: 1, minInterval: 8 },
  medium: { maxPerDay: 2, minInterval: 4 },
  high: { maxPerDay: 3, minInterval: 2 }
}
```

**设置页面 UI 示例**：

```tsx
<SettingSection title="AI 主动互动">
  <ToggleSwitch
    label="启用主动互动"
    value={settings.enabled}
    onChange={(value) => updateSetting('enabled', value)}
  />

  {settings.enabled && (
    <>
      <RadioGroup
        label="互动频率"
        value={settings.frequency}
        options={[
          { value: 'low', label: '低频（每天 1 次）' },
          { value: 'medium', label: '中频（每天 2 次）' },
          { value: 'high', label: '高频（每天 3 次）' }
        ]}
        onChange={(value) => updateSetting('frequency', value)}
      />

      <CheckboxGroup label="启用场景">
        <Checkbox
          label="定时问候（如早安、晚安）"
          checked={settings.enabledScenarios.timeBasedGreeting}
          onChange={(value) => updateScenario('timeBasedGreeting', value)}
        />
        <Checkbox
          label="日记完成后回应"
          checked={settings.enabledScenarios.diaryResponse}
          onChange={(value) => updateScenario('diaryResponse', value)}
        />
        <Checkbox
          label="长时间未互动提醒"
          checked={settings.enabledScenarios.silenceReminder}
          onChange={(value) => updateScenario('silenceReminder', value)}
        />
        <Checkbox
          label="情感关怀（基于日记分析）"
          checked={settings.enabledScenarios.sentimentCare}
          onChange={(value) => updateScenario('sentimentCare', value)}
        />
      </CheckboxGroup>

      <TimeRangePicker
        label="免打扰时段"
        start={settings.dndTimeRange.start}
        end={settings.dndTimeRange.end}
        onChange={(range) => updateSetting('dndTimeRange', range)}
      />
    </>
  )}
</SettingSection>
```

---

#### **3.2.3 自适应调整**

**根据用户反馈动态调整**：

```typescript
// 记录用户对主动消息的反应
interface UserFeedback {
  messageId: string
  action: 'clicked' | 'dismissed' | 'ignored'
  timestamp: Date
}

// 计算互动率
const calculateEngagementRate = async (): Promise<number> => {
  const last30Messages = await getProactiveMessages(30)
  const clickedCount = last30Messages.filter((m) => m.feedback?.action === 'clicked').length

  return clickedCount / last30Messages.length
}

// 自动调整频率
const autoAdjustFrequency = async () => {
  const engagementRate = await calculateEngagementRate()

  if (engagementRate < 0.2) {
    // 互动率低于 20%，降低频率
    await updateSetting('frequency', 'low')
    logger.info('主动互动频率自动降低（用户互动率低）')
  } else if (engagementRate > 0.6) {
    // 互动率高于 60%，可以适当提高频率
    const currentFreq = await getSetting('frequency')
    if (currentFreq === 'low') {
      await updateSetting('frequency', 'medium')
      logger.info('主动互动频率自动提升（用户互动率高）')
    }
  }
}

// 每周运行一次自适应调整
setInterval(autoAdjustFrequency, 7 * 24 * 60 * 60 * 1000)
```

---

### 3.3 消息生成策略

#### **3.3.1 提示词模板设计**

**基础模板**：

```typescript
const promptTemplates = {
  morningGreeting: `你是 {assistantName}，用户的 AI 陪伴伙伴。
现在是早上 {time}，请主动向用户问候早安。

要求：
- 语气温柔、自然，像朋友一样
- 询问用户今天的计划或心情
- 不要过长，控制在 50 字以内
- 可以结合最近的日记内容（如果有的话）

示例：
"早上好呀~ 昨天看你日记说今天要去见朋友，期待吗？"
"早安！今天天气不错，有什么计划吗？"`,

  diaryResponse: `你是 {assistantName}，用户刚写完日记。
请阅读以下日记内容并给予真诚的回应：

{diaryContent}

要求：
- 真诚、温暖，避免机械化的"写得很好"
- 可以就日记内容提出问题或分享感受
- 如果用户情绪低落，给予关心但不说教
- 控制在 80 字以内`,

  silenceReminder: `你是 {assistantName}，用户已经 {daysSince} 天没有写日记了。
请温柔地提醒他记录生活，但不要让他有压力。

要求：
- 语气轻松、理解，不要有负罪感
- 可以分享记录生活的意义，但不要说教
- 提供一个小的记录建议或话题
- 控制在 60 字以内

示例：
"好久不见~ 最近过得怎么样？不用有压力，随便聊聊也好呀~"
"想你啦~ 今天有什么小事想记下来吗？哪怕只是一句话~"`
}
```

---

#### **3.3.2 上下文注入**

**注入日记上下文**：

```typescript
const buildContextFromDiary = async (userId: string): Promise<string> => {
  // 获取最近 7 天的日记
  const recentDiaries = await getRecentDiaries(userId, 7)

  if (recentDiaries.length === 0) {
    return ''
  }

  // 提取关键信息
  const summary = recentDiaries.map((d) => `- ${d.date}: ${d.content.slice(0, 100)}...`).join('\n')

  return `
【用户最近的日记】
${summary}

请基于以上内容，让回应更个性化和贴心。
`
}

// 生成主动消息时注入上下文
const generateProactiveMessage = async (trigger: Trigger) => {
  const context = await buildContextFromDiary(trigger.userId)
  const prompt = trigger.promptTemplate.replace('{context}', context)

  const response = await ai.chat({
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: '请生成主动消息' }
    ]
  })

  return response.content
}
```

**注入向量记忆**：

```typescript
// 搜索相关记忆
const searchRelevantMemories = async (query: string): Promise<string> => {
  const memories = await vectorSearch(query, { limit: 3 })

  if (memories.length === 0) {
    return ''
  }

  return `
【相关记忆】
${memories.map((m) => `- ${m.content}`).join('\n')}
`
}

// 在生成消息时注入
const prompt = `${basePrompt}

${await searchRelevantMemories('用户最近的心情和状态')}

请生成主动消息。`
```

---

#### **3.3.3 个性化适配**

**基于用户画像调整语气**：

```typescript
interface UserProfile {
  preferredTone: 'casual' | 'formal' | 'playful'
  interactionHistory: {
    totalMessages: number
    averageResponseLength: number
    preferredTopics: string[]
  }
  emotionalNeeds: {
    needsEncouragement: boolean
    prefersLightConversation: boolean
  }
}

const adaptPromptToUser = (basePrompt: string, profile: UserProfile): string => {
  let adapted = basePrompt

  // 调整语气
  if (profile.preferredTone === 'playful') {
    adapted += '\n语气：活泼、可爱，可以使用颜文字 (^▽^)'
  } else if (profile.preferredTone === 'formal') {
    adapted += '\n语气：礼貌、温和，避免过于随意'
  }

  // 调整长度
  if (profile.interactionHistory.averageResponseLength < 30) {
    adapted += '\n长度：简短，不超过 40 字'
  }

  // 调整内容倾向
  if (profile.emotionalNeeds.needsEncouragement) {
    adapted += '\n倾向：多给予鼓励和肯定'
  }

  return adapted
}
```

---

## 四、通知策略实施方案

### 4.1 桌面端通知策略

#### **4.1.1 三层通知架构**

```
┌─────────────────────────────────────────────┐
│        第一层：系统通知（主要）               │
│  - 应用最小化/失焦时触发                     │
│  - Windows Action Center 显示                │
│  - 点击后打开应用并跳转到会话                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      第二层：应用内 Toast（辅助）            │
│  - 应用打开但不在对话页时触发                 │
│  - 右上角弹出，5 秒后自动消失                │
│  - 可点击"立即查看"按钮                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      第三层：直接显示（实时）                │
│  - 应用打开且在对话页时触发                  │
│  - 消息直接显示在对话列表                    │
│  - 轻提示音 + 列表滚动到最新消息              │
└─────────────────────────────────────────────┘
```

**实现代码**：

```typescript
// apps/desktop/src/main/services/proactive-chat.service.ts

private async notifyUser(
  assistantId: string,
  sessionId: string,
  message: string
) {
  const mainWindow = BrowserWindow.getAllWindows()[0]

  if (!mainWindow) {
    return
  }

  // 判断应用状态
  const isMinimized = mainWindow.isMinimized()
  const isFocused = mainWindow.isFocused()
  const isOnChatPage = await this.checkIfOnChatPage(mainWindow, sessionId)

  if (isMinimized || !isFocused) {
    // 第一层：系统通知
    this.showSystemNotification(assistantId, message, sessionId)

    // 辅助：托盘图标闪烁
    this.flashTrayIcon()
  } else if (!isOnChatPage) {
    // 第二层：应用内 Toast
    mainWindow.webContents.send('agent:show-toast', {
      assistantId,
      sessionId,
      message
    })
  } else {
    // 第三层：直接显示
    mainWindow.webContents.send('agent:proactive-message', {
      assistantId,
      sessionId,
      message,
      playSound: true
    })
  }
}

private showSystemNotification(
  assistantId: string,
  message: string,
  sessionId: string
) {
  const notification = new Notification({
    title: '白守 - Latte',
    body: message.slice(0, 120) + (message.length > 120 ? '...' : ''),
    icon: path.join(__dirname, '../../resources/icon.png'),
    silent: false
  })

  notification.on('click', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('agent:open-session', { sessionId })
    }
  })

  notification.show()
}
```

---

#### **4.1.2 通知优先级规则**

```typescript
enum NotificationPriority {
  LOW = 1, // 日常问候、非紧急提醒
  MEDIUM = 2, // 日记回应、周总结提醒
  HIGH = 3 // 情感关怀、重要日期
}

interface PriorityRule {
  priority: NotificationPriority
  canInterrupt: boolean // 是否可以打断用户当前操作
  sound: boolean
  vibrate: boolean // 移动端
}

const priorityRules: Record<NotificationPriority, PriorityRule> = {
  [NotificationPriority.LOW]: {
    priority: NotificationPriority.LOW,
    canInterrupt: false, // 不打断，仅在空闲时显示
    sound: false,
    vibrate: false
  },
  [NotificationPriority.MEDIUM]: {
    priority: NotificationPriority.MEDIUM,
    canInterrupt: true, // 可以显示但不强制
    sound: true,
    vibrate: false
  },
  [NotificationPriority.HIGH]: {
    priority: NotificationPriority.HIGH,
    canInterrupt: true,
    sound: true,
    vibrate: true
  }
}

// 根据触发类型分配优先级
const getPriority = (trigger: Trigger): NotificationPriority => {
  switch (trigger.type) {
    case 'time-based':
      return NotificationPriority.LOW
    case 'diary-response':
      return NotificationPriority.MEDIUM
    case 'sentiment-based':
      return NotificationPriority.HIGH
    default:
      return NotificationPriority.MEDIUM
  }
}
```

---

#### **4.1.3 用户交互流程**

```
用户收到通知
    ↓
┌─────────────────────────────┐
│ 用户点击通知                 │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ 应用打开并跳转到会话页面      │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ 消息已显示在对话列表          │
│ 输入框自动聚焦               │
└─────────────────────────────┘
    ↓
┌──────────────────┬──────────────────┐
│  用户回复        │  用户忽略         │
└──────────────────┴──────────────────┘
         ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│ 记录：点击+回复   │  │ 记录：忽略        │
│ 互动率+1         │  │ 互动率不变        │
└──────────────────┘  └──────────────────┘
```

**实现代码**：

```typescript
// packages/ui/src/desktop/AgentChat/AgentChat.tsx

useEffect(() => {
  // 监听主动消息事件
  const handleProactiveMessage = (event: {
    sessionId: string
    message: string
    playSound: boolean
  }) => {
    // 添加消息到对话列表
    addMessage({
      id: generateId(),
      role: 'assistant',
      content: event.message,
      timestamp: new Date(),
      metadata: {
        isProactive: true,
        priority: 'medium'
      }
    })

    // 播放提示音
    if (event.playSound) {
      playNotificationSound()
    }

    // 滚动到最新消息
    scrollToBottom()

    // 聚焦输入框
    inputRef.current?.focus()
  }

  window.api.onProactiveMessage(handleProactiveMessage)

  return () => {
    window.api.removeProactiveListener()
  }
}, [])
```

---

### 4.2 移动端通知策略

#### **4.2.1 两层通知架构**

```
┌─────────────────────────────────────────────┐
│        第一层：系统通知（主要）               │
│  - 应用后台时触发                           │
│  - Android 通知栏显示                       │
│  - 点击后打开应用并跳转到会话                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      第二层：应用内 Toast（辅助）            │
│  - 应用打开但不在对话页时触发                 │
│  - 顶部弹出，4 秒后自动消失                  │
│  - 点击后跳转到会话                         │
└─────────────────────────────────────────────┘
```

**实现代码**：

```typescript
// apps/mobile/src/services/proactive-notification.service.ts

export class ProactiveNotificationService {
  static async sendProactiveNotification(assistantId: string, sessionId: string, message: string) {
    // 检查应用状态
    const appState = AppState.currentState

    if (appState === 'active') {
      // 应用在前台：使用 Toast
      Toast.show({
        type: 'info',
        text1: 'Latte 有话对你说',
        text2: message.slice(0, 80),
        visibilityTime: 4000,
        onPress: () => {
          navigation.navigate('AgentChat', { sessionId, assistantId })
        }
      })
    } else {
      // 应用在后台：使用系统通知
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Latte',
          body: message.slice(0, 100),
          data: { sessionId, assistantId, isProactive: true },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH
        },
        trigger: null
      })
    }
  }
}
```

---

#### **4.2.2 系统限制应对**

**应对策略总结**：

| 限制类型         | 影响             | 应对方案                     |
| ---------------- | ---------------- | ---------------------------- |
| **Doze 模式**    | 后台任务延迟     | 引导用户加入电池优化白名单   |
| **厂商杀后台**   | 应用被杀死       | 提供厂商专属设置指引         |
| **通知权限拒绝** | 无法显示通知     | 降级为应用内 Toast           |
| **前台服务限制** | 必须显示持续通知 | 仅高频场景启用，明确告知用户 |

**完整实现**：

```typescript
// apps/mobile/src/services/background-setup.service.ts

export class BackgroundSetupService {
  // 检测并请求必要权限
  static async setupProactiveChat() {
    const steps: SetupStep[] = []

    // 1. 通知权限
    const notifPermission = await this.checkNotificationPermission()
    if (!notifPermission) {
      steps.push({
        title: '开启通知权限',
        description: '允许 Latte 在合适的时机主动联系你',
        action: () => this.requestNotificationPermission(),
        priority: 'high'
      })
    }

    // 2. 电池优化
    const batteryOptimized = await this.isBatteryOptimized()
    if (batteryOptimized) {
      steps.push({
        title: '允许后台运行',
        description: '让 Latte 能在你需要时主动出现',
        action: () => this.requestIgnoreBatteryOptimization(),
        priority: 'medium'
      })
    }

    // 3. 厂商设置指引
    const manufacturer = await DeviceInfo.getManufacturer()
    if (['xiaomi', 'huawei', 'oppo', 'vivo'].includes(manufacturer.toLowerCase())) {
      steps.push({
        title: '厂商权限设置',
        description: this.getManufacturerGuide(manufacturer),
        action: () => this.openManufacturerSettings(),
        priority: 'medium'
      })
    }

    return steps
  }

  // 显示设置向导
  static showSetupWizard(steps: SetupStep[]) {
    // 在 UI 中显示分步向导
    navigation.navigate('ProactiveSetup', { steps })
  }
}
```

---

#### **4.2.3 省电优化**

**策略**：

1. **智能休眠**：用户长时间未使用时，降低检查频率
2. **批量处理**：合并多个检查任务，减少唤醒次数
3. **轻量触发**：优先使用 WorkManager 而非前台服务

**实现**：

```typescript
// 智能休眠策略
const getCheckInterval = async (): Promise<number> => {
  const lastActiveTime = await getLastActiveTime()
  const hoursSinceActive = (Date.now() - lastActiveTime) / (1000 * 60 * 60)

  if (hoursSinceActive < 1) {
    return 15 * 60 // 15 分钟
  } else if (hoursSinceActive < 6) {
    return 30 * 60 // 30 分钟
  } else {
    return 60 * 60 // 1 小时
  }
}

// 使用 WorkManager 而非前台服务
import * as BackgroundFetch from 'expo-background-fetch'

await BackgroundFetch.registerTaskAsync('PROACTIVE_CHECK', {
  minimumInterval: await getCheckInterval(),
  stopOnTerminate: false,
  startOnBoot: true
})
```

---

### 4.3 跨平台一致性

#### **4.3.1 体验对齐**

| 功能         | 桌面端        | 移动端        | 一致性保证         |
| ------------ | ------------- | ------------- | ------------------ |
| **通知显示** | 系统通知      | 本地通知      | 标题、正文格式统一 |
| **点击跳转** | 打开窗口+跳转 | 打开 App+跳转 | 都能直达会话页面   |
| **免打扰**   | 23:00-08:00   | 23:00-08:00   | 时段配置同步       |
| **频率控制** | 每天 2 次     | 每天 2 次     | 频率设置同步       |
| **场景开关** | 4 种场景      | 4 种场景      | 设置项完全一致     |

---

#### **4.3.2 数据同步**

**设置同步**：

```typescript
// packages/core/src/settings/settings-manager.service.ts

interface ProactiveChatSettings {
  enabled: boolean
  frequency: 'low' | 'medium' | 'high'
  enabledScenarios: {
    timeBasedGreeting: boolean
    diaryResponse: boolean
    silenceReminder: boolean
    sentimentCare: boolean
  }
  dndTimeRange: { start: string; end: string }
  lastSyncTime: Date
}

// 云同步或局域网同步
export class SettingsSyncService {
  async syncProactiveSettings() {
    const localSettings = await getLocalSettings()
    const remoteSettings = await fetchRemoteSettings()

    // 取最新的设置
    if (remoteSettings.lastSyncTime > localSettings.lastSyncTime) {
      await saveLocalSettings(remoteSettings)
    } else {
      await uploadSettings(localSettings)
    }
  }
}
```

---

## 五、技术实现架构

### 5.1 后台服务设计

#### **5.1.1 ProactiveChatService 核心架构**

**服务职责**：

- 触发器注册与管理
- 定时任务调度
- 事件监听与响应
- 消息生成与发送
- 频率控制与防打扰

**核心代码框架**（参考现有 `summary-queue.service.ts`）：

```typescript
// apps/desktop/src/main/services/proactive-chat.service.ts

export class ProactiveChatService {
  private static instance: ProactiveChatService
  private triggers: Map<string, ProactiveTrigger> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()

  static getInstance(): ProactiveChatService {
    if (!this.instance) {
      this.instance = new ProactiveChatService()
    }
    return this.instance
  }

  async initialize(settings: ProactiveChatSettings) {
    if (!settings.enabled) return

    // 注册启用的触发器
    if (settings.enabledScenarios.timeBasedGreeting) {
      this.registerTimeTriggers(settings)
    }
    if (settings.enabledScenarios.diaryResponse) {
      this.registerEventTriggers()
    }
  }

  private registerTimeTriggers(settings: ProactiveChatSettings) {
    const timer = this.scheduleDaily('09:00', async () => {
      if (await this.canTrigger('morning-greeting')) {
        await this.executeTrigger({
          id: 'morning-greeting',
          promptTemplate: '现在是早上，请温柔地向用户问候早安。'
        })
      }
    })
    this.timers.set('morning-greeting', timer)
  }

  private async executeTrigger(trigger: ProactiveTrigger) {
    const message = await this.generateMessage(trigger)
    await this.saveAndNotify(message)
  }

  cleanup() {
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
  }
}
```

---

### 5.2 数据库扩展

#### **5.2.1 Schema 变更**

```typescript
// packages/database/src/schema/agent-messages.ts
export const agentMessagesTable = sqliteTable('agent_messages', {
  // ... 现有字段

  isProactive: integer('is_proactive', { mode: 'boolean' }).default(false),
  triggerId: text('trigger_id'),
  triggerType: text('trigger_type'),
  userFeedback: text('user_feedback') // 'clicked' | 'dismissed' | 'replied'
})

// 新增触发历史表
export const proactiveTriggersTable = sqliteTable('proactive_triggers', {
  id: text('id').primaryKey(),
  triggerId: text('trigger_id').notNull(),
  sessionId: text('session_id').notNull(),
  messageId: text('message_id').notNull(),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull(),
  userAction: text('user_action')
})
```

运行迁移：

```bash
pnpm db:generate
pnpm db:push
```

---

### 5.3 IPC 通信设计

#### **5.3.1 事件定义**

```typescript
// apps/desktop/src/preload/agent.api.ts
export const agentApi = {
  // 主进程 → 渲染进程
  onProactiveMessage: (callback: (data: { sessionId: string; message: string }) => void) => {
    ipcRenderer.on('agent:proactive-message', (_event, data) => callback(data))
  },

  // 渲染进程 → 主进程
  recordProactiveFeedback: (messageId: string, action: string) => {
    ipcRenderer.send('agent:record-feedback', { messageId, action })
  }
}
```

---

## 六、用户控制与隐私

### 6.1 用户设置选项

#### **6.1.1 设置界面设计**

```typescript
interface ProactiveChatSettings {
  enabled: boolean // 总开关
  frequency: 'low' | 'medium' | 'high' // 低频/中频/高频
  enabledScenarios: {
    timeBasedGreeting: boolean
    diaryResponse: boolean
    silenceReminder: boolean
    sentimentCare: boolean
  }
  dndTimeRange: { start: string; end: string } // 免打扰时段
}
```

**UI 示例**（桌面端）：

```tsx
<SettingSection title="AI 主动互动">
  <ToggleSwitch
    label="启用主动互动"
    value={settings.enabled}
    onChange={(value) => updateSetting('enabled', value)}
  />

  {settings.enabled && (
    <>
      <RadioGroup
        label="互动频率"
        options={[
          { value: 'low', label: '低频（每天 1 次）' },
          { value: 'medium', label: '中频（每天 2 次）' },
          { value: 'high', label: '高频（每天 3 次）' }
        ]}
      />

      <CheckboxGroup label="启用场景">
        <Checkbox label="定时问候" checked={...} />
        <Checkbox label="日记完成后回应" checked={...} />
        <Checkbox label="长时间未互动提醒" checked={...} />
      </CheckboxGroup>

      <TimeRangePicker label="免打扰时段" />
    </>
  )}
</SettingSection>
```

---

### 6.2 权限管理

#### **6.2.1 桌面端权限**

**Windows 通知权限**：

- Electron 会自动向 Windows 注册应用
- 用户可以在 Windows 设置中管理通知权限
- 应用内提供"前往系统设置"按钮

#### **6.2.2 移动端权限**

**Android 通知权限**（Android 13+）：

```typescript
const requestNotificationPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync()

  if (status !== 'granted') {
    Alert.alert('通知权限', 'Latte 的主动问候需要通知权限。你可以稍后在设置中开启。', [
      { text: '稍后', style: 'cancel' },
      { text: '前往设置', onPress: () => Linking.openSettings() }
    ])
  }
}
```

**降级策略**：

- 权限被拒绝 → 仅使用应用内 Toast
- 在设置页面显示提示："开启通知权限后，Latte 能在更多场景下联系你"

---

### 6.3 隐私保护

#### **6.3.1 本地化处理承诺**

**隐私保证声明**（显示在设置页面）：

```
🔒 白守的隐私承诺

✅ 所有主动互动逻辑在本地执行
✅ AI 分析日记的过程完全在你的设备上完成
✅ 不使用云端推送服务（FCM/APNs）
✅ 白守服务器不参与主动互动流程
✅ 唯一的网络请求是调用你配置的 AI API（与现有对话功能一致）

你可以随时在设置中关闭主动互动功能。
```

#### **6.3.2 数据透明度**

**触发历史查看**（设置 → 高级）：

```tsx
<SettingSection title="主动互动历史">
  <Text>最近 30 天，Latte 主动联系了你 {count} 次</Text>

  <List>
    {history.map((item) => (
      <ListItem key={item.id}>
        <Text>{item.triggeredAt.toLocaleDateString()}</Text>
        <Text>{item.triggerType}</Text>
        <Text>{item.userAction || '未响应'}</Text>
      </ListItem>
    ))}
  </List>

  <Button onPress={clearHistory}>清除历史</Button>
</SettingSection>
```

---

## 七、实施路线图

### 7.1 MVP 阶段（P0）— 核心功能

**目标**：验证主动互动的可行性与用户接受度

**功能范围**：

- ✅ 定时问候（早安、晚安）
- ✅ 桌面端系统通知 + 应用内 Toast
- ✅ 移动端本地通知
- ✅ 用户设置（总开关、频率、免打扰）
- ✅ 基础频率控制（每天最多 2 次）

**技术实现**：

1. 创建 `ProactiveChatService`（桌面端）
2. 扩展 `agent_messages` 表，添加 `isProactive` 字段
3. 实现系统通知和应用内 Toast
4. 添加用户设置界面

**验收标准**：

- 桌面端每天 9:00 和 22:00 能收到问候通知
- 移动端应用后台时能收到通知
- 用户可以关闭或调整频率
- 免打扰时段生效

**时间估算**：2-3 周

---

### 7.2 功能完善（P1）— 场景扩展

**目标**：增加更多触发场景，提升个性化

**新增功能**：

- ✅ 日记完成后回应
- ✅ 长时间静默提醒（7 天未写日记）
- ✅ 上下文注入（日记、记忆）
- ✅ 用户反馈记录与互动率统计
- ✅ 自适应频率调整

**技术实现**：

1. 注册事件触发器（监听 `diary-saved`）
2. 实现静默检测定时任务
3. 构建上下文注入逻辑
4. 创建 `proactive_triggers` 历史表
5. 实现自适应频率算法

**验收标准**：

- 写完日记 30 秒后收到 AI 回应
- 7 天未写日记后收到温柔提醒
- AI 消息中能体现对最近日记的了解
- 互动率低于 20% 时自动降低频率

**时间估算**：2 周

---

### 7.3 智能优化（P2）— 情感关怀

**目标**：基于情感分析的主动关怀

**新增功能**：

- ✅ 日记情感分析（调用 AI）
- ✅ 负面情绪检测与关怀
- ✅ 重要日期提醒（生日、纪念日）
- ✅ 用户画像适配（语气、长度）
- ✅ 移动端前台服务（可选，高频场景）

**技术实现**：

1. 实现情感分析接口
2. 创建情感触发器
3. 实现用户画像模块
4. 提示词个性化适配
5. Android WorkManager 集成

**验收标准**：

- 检测到负面情绪后 2 小时内主动关心
- 生日当天收到祝福
- AI 语气符合用户偏好
- 高频模式下应用被杀后仍能触发

**时间估算**：3 周

---

### 7.4 测试与迭代计划

**测试阶段**：

1. **内部测试**（1 周）
   - 开发团队自测所有触发场景
   - 验证频率控制和防打扰逻辑
   - 压力测试（模拟高频触发）

2. **小范围 Beta 测试**（2 周）
   - 邀请 20-30 名用户参与
   - 收集用户反馈（频率、语气、场景偏好）
   - 监控互动率和关闭率

3. **公开发布**
   - 默认关闭主动互动，需用户手动开启
   - 在更新日志中详细说明功能与隐私承诺
   - 提供详细的帮助文档

**迭代方向**：

- 根据互动率数据优化触发频率
- 根据用户反馈调整提示词模板
- 优化移动端电池消耗

---

## 八、附录

### 8.1 代码示例

#### **桌面端完整触发流程**

```typescript
// apps/desktop/src/main/services/proactive-chat.service.ts

export class ProactiveChatService {
  async executeTrigger(trigger: ProactiveTrigger) {
    // 1. 检查是否可以触发
    if (!(await this.canTrigger(trigger.id))) {
      logger.info(`[ProactiveChat] 触发器 ${trigger.id} 被频率控制拦截`)
      return
    }

    // 2. 构建上下文
    const context = await this.buildContext(trigger)

    // 3. 生成主动消息
    const message = await this.generateMessage(trigger, context)

    // 4. 保存到数据库
    const sessionId = await this.getOrCreateSession(trigger.assistantId)
    const messageId = await this.saveMessage(sessionId, message, {
      isProactive: true,
      triggerId: trigger.id,
      triggerType: trigger.type
    })

    // 5. 发送通知
    await this.notifyUser(trigger.assistantId, sessionId, message)

    // 6. 记录触发历史
    await this.recordTrigger(trigger.id, messageId)

    logger.info(`[ProactiveChat] 触发器 ${trigger.id} 执行成功`)
  }

  private async buildContext(trigger: ProactiveTrigger): Promise<string> {
    let context = ''

    // 注入日记上下文
    if (trigger.type === 'diary-response') {
      const recentDiaries = await getRecentDiaries(7)
      context += `\n【最近的日记】\n${recentDiaries
        .map((d) => `${d.date}: ${d.content.slice(0, 100)}...`)
        .join('\n')}`
    }

    // 注入向量记忆
    const memories = await searchMemories('用户最近的状态', 3)
    if (memories.length > 0) {
      context += `\n\n【相关记忆】\n${memories.map((m) => m.content).join('\n')}`
    }

    return context
  }

  private async generateMessage(trigger: ProactiveTrigger, context: string): Promise<string> {
    const assistant = await getAssistant(trigger.assistantId)
    const provider = getProvider(assistant.providerId)
    const model = provider.getLanguageModel(assistant.modelId)

    const prompt = `${trigger.promptTemplate}\n\n${context}`

    const response = await model.doGenerate({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请生成主动消息' }
      ]
    })

    return response.text
  }
}
```

---

### 8.2 配置参数说明

| 参数                                 | 类型                        | 默认值     | 说明                 |
| ------------------------------------ | --------------------------- | ---------- | -------------------- |
| `enabled`                            | boolean                     | `false`    | 主动互动总开关       |
| `frequency`                          | 'low' \| 'medium' \| 'high' | `'medium'` | 触发频率档位         |
| `maxPerDay`                          | number                      | `2`        | 每天最多触发次数     |
| `minInterval`                        | number                      | `4`        | 最小触发间隔（小时） |
| `dndTimeRange.start`                 | string                      | `'23:00'`  | 免打扰开始时间       |
| `dndTimeRange.end`                   | string                      | `'08:00'`  | 免打扰结束时间       |
| `enabledScenarios.timeBasedGreeting` | boolean                     | `true`     | 定时问候             |
| `enabledScenarios.diaryResponse`     | boolean                     | `true`     | 日记回应             |
| `enabledScenarios.silenceReminder`   | boolean                     | `true`     | 静默提醒             |
| `enabledScenarios.sentimentCare`     | boolean                     | `false`    | 情感关怀（P2）       |

---

### 8.3 FAQ

#### **Q1：主动互动会不会很烦人？**

A：不会。默认配置下，AI 每天最多主动联系你 2 次，且在免打扰时段（23:00-08:00）不会打扰。你可以随时在设置中调整频率或关闭。

#### **Q2：AI 会读取我的日记吗？**

A：会，但完全在本地。AI 需要读取你的日记才能生成个性化的回应，但这个过程完全在你的设备上完成，不会上传到任何服务器。

#### **Q3：我的隐私安全吗？**

A：是的。白守的主动互动功能完全本地化，不使用云端推送服务（FCM/APNs），白守服务器不参与任何主动互动流程。唯一的网络请求是调用你配置的 AI API，这与现有对话功能一致。

#### **Q4：移动端会不会很耗电？**

A：不会。默认模式下，白守使用 Android 的 WorkManager 进行轻量级后台检查，耗电量极低（每天 < 1% 电量）。仅在你开启"高频模式"时才会启用前台服务。

#### **Q5：如果我关闭了通知权限，还能用吗？**

A：可以。如果通知权限被拒绝，白守会降级为应用内 Toast 提示。当你打开应用时，依然能看到 AI 的主动消息。

#### **Q6：能不能只启用某些场景？**

A：可以。你可以在设置中单独开关"定时问候"、"日记回应"、"静默提醒"、"情感关怀"等场景。

#### **Q7：AI 的语气能不能调整？**

A：可以。在未来的 P2 阶段，白守会根据你的互动习惯自动适配语气（活泼/正式/温柔）。你也可以在助手设置中自定义系统提示词。

#### **Q8：怎么查看主动互动历史？**

A：进入设置 → AI 主动互动 → 历史记录，可以查看最近 30 天的所有触发记录，包括触发时间、类型和你的响应。

---

### 8.4 参考资料

**官方文档**：

- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Android WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)

**白守相关文档**：

- [AI 编码规范](../1-AI-Code/1-AI-Code-Rule.md)
- [提交规范](../2-Submit/1-Submit-Rule.md)
- [桌面端 README](../../apps/desktop/README.md)
- [移动端 README](../../apps/mobile/README.md)

**技术参考**：

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Vitest 测试框架](https://vitest.dev/)
- [React Native Toast Message](https://github.com/calintamas/react-native-toast-message)

---

## 结语

白守的 AI 主动互动功能是从"工具"到"伙伴"的关键一步。通过完全本地化的触发机制、精心设计的频率控制和温柔的交互体验，我们希望 AI 能够在合适的时机主动陪伴用户，而不是打扰用户。

**核心理念回顾**：

- **隐私第一**：所有逻辑在本地执行，不依赖云端推送
- **用户可控**：频率、场景、时段完全由用户掌控
- **温柔而不打扰**：适度频率，智能避让，尊重用户习惯
- **技术可靠**：降级优雅，跨平台一致，资源友好

我们相信，真正的陪伴不是时刻在线的监控，而是在你需要时恰好出现的温暖。

---

**文档版本历史**：

- v1.0.0 (2026-06-30) - 初版发布

**维护者**：白守开发团队

**反馈渠道**：GitHub Issues
