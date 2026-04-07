# 修复：JSON 响应解析

## 问题描述

Boss 反馈：AI 返回的是 JSON 格式，但在对话框中以 JSON 文本形式显示，需要：
1. 将 `content` 字段的内容显示在对话区
2. 将 `phase` 字段的值更新到 Stepper

## 解决方案

### 1. 添加 JSON 解析函数

```javascript
function parseAIResponse(text) {
  try {
    // 尝试解析整个文本为 JSON
    const parsed = JSON.parse(text);
    if (parsed.content && parsed.phase) {
      return {
        content: parsed.content,
        phase: parsed.phase
      };
    }
  } catch (e) {
    // 如果不是纯 JSON，尝试提取 JSON 部分
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.content && parsed.phase) {
          return {
            content: parsed.content,
            phase: parsed.phase
          };
        }
      } catch (e2) {
        console.warn('Failed to parse extracted JSON:', e2);
      }
    }
  }
  
  // 如果无法解析为 JSON，返回纯文本
  return {
    content: text,
    phase: null
  };
}
```

### 2. 修改发送消息逻辑

```javascript
async function sendMessage() {
  // ... 发送消息代码 ...
  
  const response = await callSupabaseChat(messages);
  
  if (response.content) {
    // 解析 JSON 格式
    const parsed = parseAIResponse(response.content);
    
    // 显示纯文本内容（去掉 JSON 包装）
    const displayContent = parsed.content || response.content;
    messages.push({ role: 'assistant', content: displayContent });
    
    // 添加到 UI
    addMessageToUI('assistant', displayContent);
    
    // 更新阶段（如果有）
    if (parsed.phase && parsed.phase !== currentPhase) {
      updateStepper(parsed.phase);
    }
  }
}
```

### 3. 添加调试日志

```javascript
console.log('📦 Received data:', parsed);
console.log('📍 Phase detected:', parsed.phase);
```

## 测试步骤

### 1. 打开浏览器控制台
访问 http://43.153.79.127:4322/chat.html，按 F12 打开开发者工具

### 2. 发送测试消息
输入：`你好，我想讨论一个问题`

### 3. 检查控制台输出
应该看到：
```
📦 Received data: {phase: 1, content: "我理解你的问题..."}
📍 Phase detected: 1
```

### 4. 检查 UI
- ✅ 对话区显示纯文本内容（不是 JSON）
- ✅ 右侧 Stepper 更新到对应阶段

## 预期效果

### 之前（问题）
```
对话区显示：
{"phase": 1, "content": "我理解你的问题，让我们澄清一下..."}
```

### 现在（修复后）
```
对话区显示：
我理解你的问题，让我们澄清一下具体是什么方面？

Stepper 更新：
Phase 1 (Understand) 高亮
```

## 兼容性处理

### 情况 1：AI 返回完整 JSON
```json
{"phase": 1, "content": "我理解你的问题"}
```
→ 解析成功，提取 content 和 phase

### 情况 2：AI 返回 JSON + 额外文本
```
好的，让我思考一下...
{"phase": 1, "content": "我理解你的问题"}
```
→ 提取 JSON 部分，解析成功

### 情况 3：AI 返回纯文本（未遵循 JSON 格式）
```
我理解你的问题，让我们讨论一下。
```
→ 直接显示文本，phase 为 null（保持当前阶段）

## 调试技巧

### 查看原始响应
在控制台查看 `📦 Received data` 日志，确认 AI 返回的格式

### 手动测试 JSON 解析
```javascript
// 在浏览器控制台运行
const test = '{"phase": 1, "content": "测试"}';
const parsed = JSON.parse(test);
console.log(parsed.content); // 应该输出 "测试"
```

### 检查 Stepper 更新
```javascript
// 在浏览器控制台运行
updateStepper(2); // 应该更新到 Phase 2
```

## 后续优化

### 短期
1. **监控 JSON 格式遵循率**
   - 统计 AI 成功返回 JSON 的比例
   - 如果经常失败，加强系统提示

2. **错误提示**
   - 如果 JSON 解析失败，显示友好提示
   - 提供重试选项

### 中期
1. **AI 模型微调**
   - 针对特定提示词进行微调
   - 提高 JSON 格式遵循率

2. **混合模式**
   - 同时支持 JSON 和纯文本
   - 自动检测并切换解析方式

---

**修复时间**: 2026-04-07 14:45
**状态**: ✅ 已实现
**测试**: 请刷新浏览器验证
