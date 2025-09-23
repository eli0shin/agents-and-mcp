/**
 * CLI authentication commands
 * Provides user-friendly authentication management interface
 */

import { select, input, confirm, password } from '@inquirer/prompts';
import { AnthropicOAuth, CredentialStore } from './auth/index.js';

// Open URL using Bun's shell API
async function open(url: string): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await Bun.$`open ${url}`;
    } else if (process.platform === 'win32') {
      await Bun.$`cmd /c start "" "${url}"`;
    } else {
      await Bun.$`xdg-open ${url}`;
    }
  } catch (error) {
    // Ignore open errors - we'll show the URL manually
    throw new Error(
      `Failed to open browser: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Login command implementation
 */
export async function loginCommand(): Promise<void> {
  process.stdout.write('\n🔐 Authentication Setup\n\n');

  const providers = [{ name: 'Anthropic (Claude)', value: 'anthropic' }];

  const provider = await select({
    message: 'Select provider:',
    choices: providers,
  });

  if (provider === 'anthropic') {
    await handleAnthropicLogin();
  } else {
    process.stderr.write('❌ Unsupported provider\n');
    process.exit(1);
  }
}

/**
 * Handle Anthropic-specific login flow
 */
async function handleAnthropicLogin(): Promise<void> {
  const methods = [
    { name: 'Claude Pro/Max (OAuth)', value: 'oauth' },
    { name: 'API Key', value: 'api' },
  ];

  const method = await select({
    message: 'Select authentication method:',
    choices: methods,
  });

  if (method === 'oauth') {
    await handleOAuthLogin();
  } else if (method === 'api') {
    await handleApiKeyLogin();
  }
}

/**
 * Handle OAuth login flow
 */
async function handleOAuthLogin(): Promise<void> {
  try {
    process.stdout.write('\n🚀 Starting OAuth flow...\n');

    const { url, verifier } = await AnthropicOAuth.authorize();

    process.stdout.write('📱 Opening browser for authorization...\n');
    process.stdout.write("If the browser doesn't open automatically, visit:\n");
    process.stdout.write(`   ${url}\n`);

    try {
      await open(url);
    } catch {
      process.stdout.write('⚠️  Failed to open browser automatically\n');
    }

    process.stdout.write(
      "\nAfter authorizing, you'll be redirected to a page with an authorization code.\n"
    );
    const code = await input({
      message: '📋 Paste the authorization code here:',
    });

    if (!code) {
      process.stderr.write('❌ No authorization code provided\n');
      process.exit(1);
    }

    process.stdout.write('🔄 Exchanging code for tokens...\n');
    await AnthropicOAuth.exchange(code, verifier);

    process.stdout.write('✅ OAuth login successful!\n');
    process.stdout.write('🎉 You can now use Claude Pro/Max features\n');
  } catch (error) {
    process.stderr.write(
      `❌ OAuth login failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}

/**
 * Handle API key login flow
 */
async function handleApiKeyLogin(): Promise<void> {
  try {
    process.stdout.write('\n🔑 API Key Setup\n');
    process.stdout.write(
      'Get your API key from: https://console.anthropic.com/\n'
    );

    const apiKey = await password({
      message: 'Enter your Anthropic API key:',
    });

    if (!apiKey) {
      process.stderr.write('❌ No API key provided\n');
      process.exit(1);
    }

    // Basic validation - Anthropic API keys start with 'sk-ant-'
    if (!apiKey.startsWith('sk-ant-')) {
      process.stdout.write(
        '⚠️  Warning: API key format looks unusual (should start with sk-ant-)\n'
      );
      const shouldContinue = await confirm({
        message: 'Continue anyway?',
        default: false,
      });
      if (!shouldContinue) {
        process.stderr.write('❌ Cancelled\n');
        process.exit(1);
      }
    }

    await CredentialStore.set('anthropic', {
      type: 'api',
      key: apiKey,
    });

    process.stdout.write('✅ API key saved successfully!\n');
  } catch (error) {
    process.stderr.write(
      `❌ API key setup failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}

/**
 * Logout command implementation
 */
export async function logoutCommand(): Promise<void> {
  try {
    const credentials = await CredentialStore.list();
    const providers = Object.keys(credentials);

    if (providers.length === 0) {
      process.stdout.write('ℹ️  No stored credentials found\n');
      return;
    }

    process.stdout.write('\n🚪 Logout\n\n');

    if (providers.length === 1) {
      const provider = providers[0]!;
      const credential = credentials[provider];

      if (credential) {
        process.stdout.write(
          `Removing ${provider} credentials (${credential.type})\n`
        );
        const shouldLogout = await confirm({
          message: 'Are you sure?',
          default: false,
        });

        if (shouldLogout) {
          await CredentialStore.remove(provider);
          process.stdout.write('✅ Logged out successfully\n');
        } else {
          process.stdout.write('❌ Cancelled\n');
        }
      }
    } else {
      // Multiple providers - let user choose
      const choices = providers.map((provider) => {
        const credential = credentials[provider];
        return {
          name: `${provider} (${credential?.type || 'unknown'})`,
          value: provider,
        };
      });

      const provider = await select({
        message: 'Select provider to logout:',
        choices,
      });

      const shouldLogout = await confirm({
        message: 'Are you sure?',
        default: false,
      });
      if (shouldLogout) {
        await CredentialStore.remove(provider);
        process.stdout.write('✅ Logged out successfully\n');
      } else {
        process.stdout.write('❌ Cancelled\n');
      }
    }
  } catch (error) {
    process.stderr.write(
      `❌ Logout failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}

/**
 * List command implementation
 */
export async function listCommand(): Promise<void> {
  try {
    const credentials = await CredentialStore.list();
    const authFilePath = CredentialStore.getAuthFilePath();

    process.stdout.write(`\n📄 Stored Credentials (${authFilePath})\n\n`);

    if (Object.keys(credentials).length === 0) {
      process.stdout.write('ℹ️  No stored credentials\n');
      process.stdout.write('   Run: npx . auth login\n');
      return;
    }

    for (const [provider, credential] of Object.entries(credentials)) {
      const authType = credential.type;
      let status = '';

      if (credential.type === 'oauth') {
        const isValid = await AnthropicOAuth.isAuthenticated();
        status = isValid ? '✅ valid' : '❌ expired/invalid';
      } else {
        status = '🔑 api-key';
      }

      process.stdout.write(`  ${provider}: ${authType} ${status}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `❌ Failed to list credentials: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}

/**
 * Status command implementation
 */
export async function statusCommand(): Promise<void> {
  try {
    process.stdout.write('\n📊 Authentication Status\n\n');

    const credentials = await CredentialStore.list();

    if (Object.keys(credentials).length === 0) {
      process.stdout.write('❌ No authentication configured\n');
      process.stdout.write('   Run: npx . auth login\n');
      return;
    }

    // Check Anthropic specifically since it's our main provider
    const anthropicCreds = credentials.anthropic;
    if (anthropicCreds) {
      if (anthropicCreds.type === 'oauth') {
        const isAuthenticated = await AnthropicOAuth.isAuthenticated();
        if (isAuthenticated) {
          process.stdout.write(
            '✅ Anthropic: OAuth authenticated (Claude Pro/Max)\n'
          );
        } else {
          process.stdout.write('❌ Anthropic: OAuth token expired/invalid\n');
          process.stdout.write('   Run: npx . auth login\n');
        }
      } else {
        process.stdout.write('✅ Anthropic: API key configured\n');
      }
    } else {
      process.stdout.write('❌ Anthropic: Not configured\n');
      process.stdout.write('   Run: npx . auth login\n');
    }
  } catch (error) {
    process.stderr.write(
      `❌ Status check failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}
