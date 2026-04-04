// 测试聊天 API 的语言检测功能

async function testChat(message, language) {
  console.log(`\n=== 测试 ${language} 输入 ===`);
  console.log(`用户消息: "${message}"`);
  
  const response = await fetch('http://localhost:4322/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: message }
      ],
      conversationId: null
    }),
  });
  
  if (!response.ok) {
    console.error(`API 错误: ${response.status}`);
    return;
  }
  
  // 读取 SSE 流
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullResponse += parsed.content;
            process.stdout.write(parsed.content);
          }
          if (parsed.conversationId) {
            console.log(`\n对话ID: ${parsed.conversationId}`);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  console.log(`\n完整回复长度: ${fullResponse.length} 字符`);
  
  // 简单分析回复语言
  const chineseRegex = /[\u4e00-\u9fff]/g;
  const englishRegex = /[a-zA-Z]/g;
  
  const chineseChars = (fullResponse.match(chineseRegex) || []).length;
  const englishChars = (fullResponse.match(englishRegex) || []).length;
  
  console.log(`回复分析: 中文字符=${chineseChars}, 英文字符=${englishChars}`);
  
  if (language === 'chinese' && chineseChars > englishChars) {
    console.log('✅ 测试通过: AI 使用中文回复');
  } else if (language === 'english' && englishChars > chineseChars) {
    console.log('✅ 测试通过: AI 使用英文回复');
  } else {
    console.log('⚠️  语言检测可能有问题');
  }
}

async function main() {
  console.log('开始测试 first-principle 聊天功能语言检测...');
  
  // 测试中文输入
  await testChat('你好，我有一个关于职业发展的问题', 'chinese');
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 测试英文输入
  await testChat('Hello, I have a question about career development', 'english');
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 测试混合输入（应该偏向英文）
  await testChat('你好hello，我想讨论一个问题discuss a problem', 'english');
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
main().catch(console.error);