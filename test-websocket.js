#!/usr/bin/env node

import WebSocket from 'ws';

// Test WebSocket connection
const testWebSocket = (url, uid) => {
  console.log(`\n🔗 Testing WebSocket connection...`);
  console.log(`   URL: ${url}`);
  console.log(`   UID: ${uid}\n`);

  const wsUrl = `${url}?uid=${uid}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully!');
    
    // Send a test message
    const testMessage = {
      id: 'test-' + Date.now(),
      content: 'Hello from test script',
      session: 'test-session'
    };
    
    console.log('📤 Sending test message:', JSON.stringify(testMessage, null, 2));
    ws.send(JSON.stringify(testMessage));
    
    // Close after 2 seconds
    setTimeout(() => {
      console.log('👋 Closing connection...');
      ws.close();
    }, 2000);
  });

  ws.on('message', (data) => {
    console.log('📥 Received message:', data.toString());
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed (code: ${code}, reason: ${reason || 'none'})`);
    process.exit(code === 1000 ? 0 : 1);
  });
};

// Parse command line arguments
const args = process.argv.slice(2);
let url = 'wss://openclaw-webhook.sternelee2571.workers.dev/ws';
let uid = 'd895ea78-718d-4188-8da9-bba99f0d359d';

if (args.length > 0) url = args[0];
if (args.length > 1) uid = args[1];

testWebSocket(url, uid);
