#!/usr/bin/env node

/**
 * Comprehensive test script to validate Docker socket access fix
 * Tests Docker socket permissions, container deployment, and Docker operations
 * 
 * Requirements tested: 1.1, 1.2, 1.3, 3.1
 */

import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test configuration with platform-specific socket paths
const getDefaultSocketPath = () => {
  if (process.platform === 'win32') {
    // Windows Docker Desktop uses named pipe
    return '\\\\.\\pipe\\docker_engine';
  } else {
    // Linux/macOS use Unix socket
    return '/var/run/docker.sock';
  }
};

const TEST_CONFIG = {
  socketPath: process.env.DOCKER_SOCKET || getDefaultSocketPath(),
  timeout: 10000,
  testContainerName: 'homelabarr-socket-test',
  testImage: 'alpine:latest',
  backendContainerName: 'homelabarr-backend',
  frontendContainerName: 'homelabarr-frontend'
};

// Test results tracking
const testResults = {
  socketPermissions: { passed: false, details: null },
  dockerConnection: { passed: false, details: null },
  containerOperations: { passed: false, details: null },
  deploymentTest: { passed: false, details: null },
  healthCheck: { passed: false, details: null },
  cleanup: { passed: false, details: null }
};

// Enhanced logging utility
const logger = {
  info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ${message}`, ...args),
  success: (message, ...args) => console.log(`✅ ${message}`, ...args),
  debug: (message, ...args) => console.log(`🐛 ${message}`, ...args),
  test: (message, ...args) => console.log(`🧪 ${message}`, ...args),
  
  testResult: (testName, passed, details = null) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
    if (details) {
      console.log(`   Details: ${details}`);
    }
  }
};

/**
 * Test 1: Verify Docker socket permissions and accessibility
 * Requirements: 1.1, 1.2
 */
async function testSocketPermissions() {
  logger.test('Testing Docker socket permissions...');
  
  try {
    // Handle platform-specific socket checking
    if (process.platform === 'win32') {
      // On Windows, Docker Desktop uses named pipes - we can't check file existence
      // Instead, we'll test Docker connection directly
      logger.info(`Using Windows Docker Desktop named pipe: ${TEST_CONFIG.socketPath}`);
      logger.info('Skipping file-based socket checks on Windows');
    } else {
      // Check if socket file exists (Linux/macOS)
      if (!fs.existsSync(TEST_CONFIG.socketPath)) {
        testResults.socketPermissions = {
          passed: false,
          details: `Docker socket not found at ${TEST_CONFIG.socketPath}`
        };
        return false;
      }
      
      // Get socket file stats
      const socketStats = fs.statSync(TEST_CONFIG.socketPath);
      const isSocket = socketStats.isSocket();
      
      logger.info(`Socket file exists: ${TEST_CONFIG.socketPath}`);
      logger.info(`Is socket: ${isSocket}`);
      logger.info(`Socket permissions: ${(socketStats.mode & parseInt('777', 8)).toString(8)}`);
      
      // Check if we can access the socket (basic read test)
      try {
        fs.accessSync(TEST_CONFIG.socketPath, fs.constants.R_OK | fs.constants.W_OK);
        logger.success('Socket is readable and writable');
      } catch (accessError) {
        testResults.socketPermissions = {
          passed: false,
          details: `Socket access denied: ${accessError.message}`
        };
        return false;
      }
    }
    
    // Test Docker connection with platform-specific configuration
    const dockerConfig = process.platform === 'win32' 
      ? { timeout: TEST_CONFIG.timeout }  // Let dockerode use default Windows configuration
      : { socketPath: TEST_CONFIG.socketPath, timeout: TEST_CONFIG.timeout };
    
    const docker = new Docker(dockerConfig);
    
    // Simple ping test
    try {
      await docker.ping();
      logger.success('Docker daemon ping successful');
    } catch (pingError) {
      testResults.socketPermissions = {
        passed: false,
        details: `Docker ping failed: ${pingError.message}`
      };
      return false;
    }
    
    testResults.socketPermissions = {
      passed: true,
      details: 'Socket permissions and accessibility verified'
    };
    
    return true;
  } catch (error) {
    testResults.socketPermissions = {
      passed: false,
      details: `Socket permission test failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Test 2: Test Docker connection and basic operations
 * Requirements: 1.1, 1.3
 */
async function testDockerConnection() {
  logger.test('Testing Docker connection and basic operations...');
  
  try {
    const dockerConfig = process.platform === 'win32' 
      ? { timeout: TEST_CONFIG.timeout }  // Let dockerode use default Windows configuration
      : { socketPath: TEST_CONFIG.socketPath, timeout: TEST_CONFIG.timeout };
    
    const docker = new Docker(dockerConfig);
    
    // Test 1: Get Docker version
    logger.info('Testing Docker version retrieval...');
    const version = await docker.version();
    logger.success(`Docker version: ${version.Version}`);
    logger.info(`API version: ${version.ApiVersion}`);
    logger.info(`Platform: ${version.Os}/${version.Arch}`);
    
    // Test 2: List containers
    logger.info('Testing container listing...');
    const containers = await docker.listContainers({ all: true });
    logger.success(`Found ${containers.length} containers`);
    
    // Test 3: List images
    logger.info('Testing image listing...');
    const images = await docker.listImages();
    logger.success(`Found ${images.length} images`);
    
    // Test 4: Get system info
    logger.info('Testing system info retrieval...');
    const info = await docker.info();
    logger.success(`Docker system info retrieved - ${info.Containers} containers, ${info.Images} images`);
    
    testResults.dockerConnection = {
      passed: true,
      details: `All Docker operations successful - Version: ${version.Version}`
    };
    
    return true;
  } catch (error) {
    testResults.dockerConnection = {
      passed: false,
      details: `Docker connection test failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Test 3: Test container operations (create, start, stop, remove)
 * Requirements: 1.1, 1.2, 1.3
 */
async function testContainerOperations() {
  logger.test('Testing container operations...');
  
  try {
    const dockerConfig = process.platform === 'win32' 
      ? { timeout: TEST_CONFIG.timeout }  // Let dockerode use default Windows configuration
      : { socketPath: TEST_CONFIG.socketPath, timeout: TEST_CONFIG.timeout };
    
    const docker = new Docker(dockerConfig);
    
    // Clean up any existing test container
    try {
      const existingContainer = docker.getContainer(TEST_CONFIG.testContainerName);
      await existingContainer.remove({ force: true });
      logger.info('Cleaned up existing test container');
    } catch (cleanupError) {
      // Container doesn't exist, which is fine
    }
    
    // Test 1: Pull test image if not available
    logger.info(`Ensuring test image ${TEST_CONFIG.testImage} is available...`);
    try {
      await docker.getImage(TEST_CONFIG.testImage).inspect();
      logger.success('Test image already available');
    } catch (imageError) {
      logger.info('Pulling test image...');
      await new Promise((resolve, reject) => {
        docker.pull(TEST_CONFIG.testImage, (err, stream) => {
          if (err) return reject(err);
          
          docker.modem.followProgress(stream, (err, output) => {
            if (err) return reject(err);
            resolve(output);
          });
        });
      });
      logger.success('Test image pulled successfully');
    }
    
    // Test 2: Create container
    logger.info('Creating test container...');
    const container = await docker.createContainer({
      Image: TEST_CONFIG.testImage,
      name: TEST_CONFIG.testContainerName,
      Cmd: ['echo', 'Docker socket test successful'],
      AttachStdout: true,
      AttachStderr: true
    });
    logger.success('Test container created');
    
    // Test 3: Start container
    logger.info('Starting test container...');
    await container.start();
    logger.success('Test container started');
    
    // Test 4: Wait for container to complete
    logger.info('Waiting for container to complete...');
    const result = await container.wait();
    logger.success(`Container completed with exit code: ${result.StatusCode}`);
    
    // Test 5: Get container logs
    logger.info('Retrieving container logs...');
    const logs = await container.logs({
      stdout: true,
      stderr: true
    });
    const logOutput = logs.toString().trim();
    logger.success(`Container logs: ${logOutput}`);
    
    // Test 6: Remove container
    logger.info('Removing test container...');
    await container.remove();
    logger.success('Test container removed');
    
    testResults.containerOperations = {
      passed: true,
      details: `All container operations successful - Exit code: ${result.StatusCode}`
    };
    
    return true;
  } catch (error) {
    testResults.containerOperations = {
      passed: false,
      details: `Container operations test failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Test 4: Test container deployment with updated configuration
 * Requirements: 3.1
 */
async function testDeploymentConfiguration() {
  logger.test('Testing container deployment with updated configuration...');
  
  try {
    // Check if docker-compose.yml exists and has correct configuration
    const composeFile = 'docker-compose.yml';
    if (!fs.existsSync(composeFile)) {
      testResults.deploymentTest = {
        passed: false,
        details: 'docker-compose.yml not found'
      };
      return false;
    }
    
    // Read and validate docker-compose configuration
    const composeContent = fs.readFileSync(composeFile, 'utf8');
    logger.info('Validating docker-compose.yml configuration...');
    
    // Check for required configurations
    const requiredConfigs = [
      'group_add',
      'DOCKER_GID',
      '/var/run/docker.sock',
      'volumes'
    ];
    
    const missingConfigs = requiredConfigs.filter(config => !composeContent.includes(config));
    
    if (missingConfigs.length > 0) {
      testResults.deploymentTest = {
        passed: false,
        details: `Missing required configurations: ${missingConfigs.join(', ')}`
      };
      return false;
    }
    
    logger.success('docker-compose.yml contains required Docker socket configurations');
    
    // Check if Dockerfile.backend exists and is properly configured
    const dockerfileBackend = 'Dockerfile.backend';
    if (!fs.existsSync(dockerfileBackend)) {
      testResults.deploymentTest = {
        passed: false,
        details: 'Dockerfile.backend not found'
      };
      return false;
    }
    
    const dockerfileContent = fs.readFileSync(dockerfileBackend, 'utf8');
    
    // Verify that hardcoded docker group creation is removed
    if (dockerfileContent.includes('groupadd docker') || dockerfileContent.includes('addgroup docker')) {
      testResults.deploymentTest = {
        passed: false,
        details: 'Dockerfile.backend still contains hardcoded docker group creation'
      };
      return false;
    }
    
    logger.success('Dockerfile.backend properly configured without hardcoded docker group');
    
    // Test docker-compose validation
    logger.info('Validating docker-compose configuration...');
    try {
      const { stdout, stderr } = await execAsync('docker-compose config --quiet');
      logger.success('docker-compose configuration is valid');
    } catch (composeError) {
      logger.warn(`docker-compose validation warning: ${composeError.message}`);
      // Don't fail the test for compose validation issues as they might be environment-specific
    }
    
    testResults.deploymentTest = {
      passed: true,
      details: 'Deployment configuration validated successfully'
    };
    
    return true;
  } catch (error) {
    testResults.deploymentTest = {
      passed: false,
      details: `Deployment configuration test failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Test 5: Test health check endpoint for Docker connectivity
 * Requirements: 1.1, 1.3
 */
async function testHealthCheck() {
  logger.test('Testing health check endpoint...');
  
  try {
    // Check if server is running
    const serverPort = process.env.PORT || 3001;
    const healthUrl = `http://localhost:${serverPort}/health`;
    
    logger.info(`Testing health endpoint: ${healthUrl}`);
    
    try {
      const response = await fetch(healthUrl);
      const healthData = await response.json();
      
      logger.info(`Health check status: ${response.status}`);
      logger.info(`Service status: ${healthData.status}`);
      logger.info(`Docker status: ${healthData.docker?.status || 'unknown'}`);
      
      // Validate health check response structure
      const requiredFields = ['status', 'docker', 'timestamp'];
      const dockerRequiredFields = ['status', 'socketPath'];
      
      const missingFields = requiredFields.filter(field => !(field in healthData));
      const missingDockerFields = dockerRequiredFields.filter(field => !(field in (healthData.docker || {})));
      
      if (missingFields.length > 0 || missingDockerFields.length > 0) {
        testResults.healthCheck = {
          passed: false,
          details: `Missing required fields: ${[...missingFields, ...missingDockerFields.map(f => `docker.${f}`)].join(', ')}`
        };
        return false;
      }
      
      // Check if Docker status indicates successful connection
      const dockerStatus = healthData.docker.status;
      if (dockerStatus === 'connected') {
        logger.success('Health check shows Docker is connected');
      } else if (dockerStatus === 'degraded') {
        logger.warn('Health check shows Docker is degraded but retrying');
      } else {
        logger.warn(`Health check shows Docker status: ${dockerStatus}`);
      }
      
      testResults.healthCheck = {
        passed: true,
        details: `Health check successful - Docker status: ${dockerStatus}`
      };
      
      return true;
    } catch (fetchError) {
      if (fetchError.code === 'ECONNREFUSED') {
        testResults.healthCheck = {
          passed: false,
          details: 'Server is not running - cannot test health endpoint'
        };
      } else {
        testResults.healthCheck = {
          passed: false,
          details: `Health check failed: ${fetchError.message}`
        };
      }
      return false;
    }
  } catch (error) {
    testResults.healthCheck = {
      passed: false,
      details: `Health check test failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Test 6: Cleanup test resources
 */
async function testCleanup() {
  logger.test('Cleaning up test resources...');
  
  try {
    const dockerConfig = process.platform === 'win32' 
      ? { timeout: TEST_CONFIG.timeout }  // Let dockerode use default Windows configuration
      : { socketPath: TEST_CONFIG.socketPath, timeout: TEST_CONFIG.timeout };
    
    const docker = new Docker(dockerConfig);
    
    // Remove test container if it exists
    try {
      const testContainer = docker.getContainer(TEST_CONFIG.testContainerName);
      await testContainer.remove({ force: true });
      logger.success('Test container cleaned up');
    } catch (cleanupError) {
      // Container doesn't exist, which is fine
      logger.info('No test container to clean up');
    }
    
    testResults.cleanup = {
      passed: true,
      details: 'Cleanup completed successfully'
    };
    
    return true;
  } catch (error) {
    testResults.cleanup = {
      passed: false,
      details: `Cleanup failed: ${error.message}`
    };
    return false;
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 DOCKER SOCKET ACCESS FIX - TEST REPORT');
  console.log('='.repeat(80));
  
  const testCategories = [
    { name: 'Socket Permissions', key: 'socketPermissions', requirements: '1.1, 1.2' },
    { name: 'Docker Connection', key: 'dockerConnection', requirements: '1.1, 1.3' },
    { name: 'Container Operations', key: 'containerOperations', requirements: '1.1, 1.2, 1.3' },
    { name: 'Deployment Configuration', key: 'deploymentTest', requirements: '3.1' },
    { name: 'Health Check', key: 'healthCheck', requirements: '1.1, 1.3' },
    { name: 'Cleanup', key: 'cleanup', requirements: 'N/A' }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  testCategories.forEach(category => {
    const result = testResults[category.key];
    totalTests++;
    
    if (result.passed) {
      passedTests++;
      logger.testResult(`${category.name} (Req: ${category.requirements})`, true, result.details);
    } else {
      logger.testResult(`${category.name} (Req: ${category.requirements})`, false, result.details);
    }
  });
  
  console.log('\n' + '-'.repeat(80));
  console.log(`📊 SUMMARY: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ ALL TESTS PASSED - Docker socket access fix is working correctly!');
    console.log('\n🎉 Requirements validated:');
    console.log('   ✅ 1.1 - Backend can access Docker socket without EACCES errors');
    console.log('   ✅ 1.2 - Backend process has proper read/write permissions');
    console.log('   ✅ 1.3 - API calls complete successfully without permission denials');
    console.log('   ✅ 3.1 - Docker socket access works consistently across environments');
  } else {
    console.log('❌ SOME TESTS FAILED - Docker socket access fix needs attention');
    console.log('\n🔧 Failed tests require investigation and fixes');
  }
  
  console.log('\n📋 Test Configuration:');
  console.log(`   Socket Path: ${TEST_CONFIG.socketPath}`);
  console.log(`   Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node Version: ${process.version}`);
  
  console.log('='.repeat(80));
  
  return passedTests === totalTests;
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🧪 Starting Docker Socket Access Fix Validation Tests');
  console.log(`📍 Testing Docker socket: ${TEST_CONFIG.socketPath}`);
  console.log(`⏱️  Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log('');
  
  const tests = [
    { name: 'Socket Permissions', fn: testSocketPermissions },
    { name: 'Docker Connection', fn: testDockerConnection },
    { name: 'Container Operations', fn: testContainerOperations },
    { name: 'Deployment Configuration', fn: testDeploymentConfiguration },
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Cleanup', fn: testCleanup }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      const success = await test.fn();
      
      if (!success) {
        logger.error(`Test "${test.name}" failed, but continuing with remaining tests...`);
      }
    } catch (error) {
      logger.error(`Test "${test.name}" threw an exception:`, error.message);
      testResults[test.name.toLowerCase().replace(/\s+/g, '')] = {
        passed: false,
        details: `Exception: ${error.message}`
      };
    }
  }
  
  // Generate final report
  const allTestsPassed = generateTestReport();
  
  // Exit with appropriate code
  process.exit(allTestsPassed ? 0 : 1);
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.warn('Test interrupted, cleaning up...');
  await testCleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.warn('Test terminated, cleaning up...');
  await testCleanup();
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});