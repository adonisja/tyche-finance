import { createAgent, getModelConfig, MODELS } from './index';

/**
 * Simple test to verify AI provider setup
 * Run with: node dist/test.js
 */

async function testAISetup() {
  console.log('🧪 Testing Tyche AI Provider Setup\n');

  // Test 1: Config loading
  console.log('✓ Test 1: Configuration');
  try {
    const config = getModelConfig();
    console.log(`  Provider: ${config.provider}`);
    console.log(`  Model: ${config.model}`);
    console.log(`  Has API Key: ${config.apiKey ? '✅ Yes' : '❌ No'}`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }

  // Test 2: Available models
  console.log('\n✓ Test 2: Available Models');
  console.log('  Anthropic:', Object.keys(MODELS.anthropic).join(', '));
  console.log('  OpenAI:', Object.keys(MODELS.openai).join(', '));
  console.log('  xAI:', Object.keys(MODELS.xai).join(', '));
  console.log('  DeepSeek:', Object.keys(MODELS.deepseek).join(', '));

  // Test 3: Agent creation
  console.log('\n✓ Test 3: Agent Creation');
  try {
    const agent = createAgent({ userId: 'test-user' });
    const model = agent.getModel();
    console.log(`  ✅ Agent created successfully`);
    console.log(`  Using: ${model.provider}/${model.model}`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    if (error.message.includes('API key')) {
      console.log('  💡 Tip: Set appropriate API key environment variable');
    }
  }

  console.log('\n✅ All tests complete!');
  console.log('\n📝 Next steps:');
  console.log('  1. Set AI_PROVIDER environment variable (anthropic, openai, xai, deepseek)');
  console.log('  2. Set the corresponding API key (e.g., ANTHROPIC_API_KEY)');
  console.log('  3. Run: npm run build --workspace=@tyche/ai');
  console.log('  4. Test with real API: node -e "import(\'./dist/index.js\').then(m => m.createAgent({userId:\'test\'}).chat([{role:\'user\',content:\'Hello!\'}]).then(console.log))"');
}

testAISetup().catch(console.error);
