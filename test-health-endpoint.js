#!/usr/bin/env node

/**
 * Simple test script to verify the enhanced health check endpoint
 */

import http from 'http';

const TEST_PORT = process.env.PORT || 3001;
const HEALTH_ENDPOINT = `http://localhost:${TEST_PORT}/health`;

async function testHealthEndpoint() {
  console.log('🧪 Testing enhanced health check endpoint...\n');
  
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    const data = await response.json();
    
    console.log(`📊 Status Code: ${response.status}`);
    console.log(`📊 Response Status: ${data.status}`);
    console.log(`🐳 Docker Status: ${data.docker?.status || 'unknown'}`);
    
    if (data.docker?.lastError) {
      console.log(`❌ Last Error: ${data.docker.lastError.type} - ${data.docker.lastError.userMessage}`);
    }
    
    if (data.docker?.retry) {
      console.log(`🔄 Retry Status: ${data.docker.retry.retryProgress} (${data.docker.retry.isRetrying ? 'retrying' : 'not retrying'})`);
    }
    
    if (data.docker?.version) {
      console.log(`🐳 Docker Version: ${data.docker.version.version}`);
    }
    
    console.log(`⏰ Timestamp: ${data.timestamp}`);
    console.log(`⏱️  Uptime: ${Math.floor(data.uptime || 0)}s`);
    
    console.log('\n📋 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Verify required fields are present
    const requiredFields = ['status', 'docker', 'timestamp'];
    const dockerRequiredFields = ['status', 'socketPath'];
    
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.log(`❌ Missing required field: ${field}`);
        allFieldsPresent = false;
      }
    }
    
    for (const field of dockerRequiredFields) {
      if (!(field in (data.docker || {}))) {
        console.log(`❌ Missing required docker field: ${field}`);
        allFieldsPresent = false;
      }
    }
    
    if (allFieldsPresent) {
      console.log('\n✅ All required fields are present');
    }
    
    // Test different scenarios based on Docker status
    if (data.docker.status === 'connected') {
      console.log('\n✅ Docker is connected - health check working correctly');
    } else if (data.docker.status === 'degraded') {
      console.log('\n⚠️  Docker is degraded - retry information should be present');
      if (data.docker.retry) {
        console.log('✅ Retry information is present');
      } else {
        console.log('❌ Retry information is missing for degraded status');
      }
    } else {
      console.log('\n❌ Docker is disconnected/error - detailed error info should be present');
      if (data.docker.lastError) {
        console.log('✅ Error information is present');
      } else {
        console.log('❌ Error information is missing');
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running. Please start the server first with: npm run dev');
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
}

// Check if server is likely running on the expected port
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/health',
      method: 'HEAD',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

async function main() {
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.log('⚠️  Server doesn\'t appear to be running on port 3001');
    console.log('💡 You can start the server with: npm run dev');
    console.log('🔧 Or start just the backend with: node server/index.js');
    console.log('\n📝 This test expects the server to be running on port 3001');
    console.log('   If your server runs on a different port, update TEST_PORT in this script\n');
  }
  
  await testHealthEndpoint();
}

main().catch(console.error);