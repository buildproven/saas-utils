/**
 * Environment Variable Management
 * Utilities for managing Stripe secrets in Vercel and other platforms
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'

export type VercelEnvironment = 'production' | 'preview' | 'development'

export interface EnvUpdateResult {
  success: boolean
  message: string
  environment: VercelEnvironment
}

/**
 * Update a Vercel environment variable
 * Removes existing value and adds new one
 */
export async function updateVercelEnv(
  name: string,
  value: string,
  environment: VercelEnvironment = 'production',
  cwd?: string
): Promise<EnvUpdateResult> {
  const options = cwd
    ? { cwd, stdio: 'pipe' as const }
    : { stdio: 'pipe' as const }

  try {
    // Remove existing env var (ignore errors if it doesn't exist)
    try {
      execFileSync('vercel', ['env', 'rm', name, environment, '-y'], options)
    } catch {
      // Ignore - variable may not exist
    }

    // Add new env var
    execFileSync('vercel', ['env', 'add', name, environment], {
      ...options,
      input: `${value}\n`,
    })

    return {
      success: true,
      message: `Updated ${name} in Vercel ${environment}`,
      environment,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Failed to update ${name}: ${message}`,
      environment,
    }
  }
}

/**
 * Trigger a Vercel redeploy
 */
export async function triggerVercelRedeploy(
  cwd?: string,
  production = true
): Promise<{ success: boolean; message: string }> {
  const options = cwd
    ? { cwd, stdio: 'pipe' as const, timeout: 120000 }
    : { stdio: 'pipe' as const, timeout: 120000 }

  try {
    const flags = production ? ['--prod', '--force'] : ['--force']
    execFileSync('vercel', flags, options)
    return {
      success: true,
      message: 'Vercel redeploy triggered successfully',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Redeploy failed: ${message}`,
    }
  }
}

/**
 * Read Stripe secret key from local .env file
 * Useful for scripts that need to access Stripe API
 */
export function readStripeKeyFromEnv(envPath: string): string | null {
  try {
    const content = readFileSync(envPath, 'utf8')
    const match = content.match(/STRIPE_SECRET_KEY=(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

/**
 * Read any env var from local .env file
 * Uses simple string parsing instead of dynamic regex for security
 */
export function readEnvVar(envPath: string, varName: string): string | null {
  try {
    const content = readFileSync(envPath, 'utf8')
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith(varName + '=')) {
        let value = trimmed.slice(varName.length + 1).trim()
        // Remove surrounding quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        return value || null
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Mask a secret for logging (show only last N chars)
 */
export function maskSecret(secret: string, visibleChars = 8): string {
  if (secret.length <= visibleChars) {
    return '*'.repeat(secret.length)
  }
  return '*'.repeat(secret.length - visibleChars) + secret.slice(-visibleChars)
}

/**
 * Full webhook setup flow:
 * 1. Recreate webhook with fresh secret
 * 2. Update Vercel environment variable
 * 3. Trigger redeploy
 */
export interface FullSetupOptions {
  stripeSecretKey: string
  webhookUrl: string
  events: string[]
  vercelCwd?: string
  description?: string
}

export interface FullSetupResult {
  success: boolean
  endpointId?: string
  secret?: string
  steps: Array<{ step: string; success: boolean; message: string }>
}

export async function fullWebhookSetup(
  options: FullSetupOptions
): Promise<FullSetupResult> {
  const { recreateWebhook } = await import('./webhooks')
  const steps: Array<{ step: string; success: boolean; message: string }> = []

  try {
    // Step 1: Recreate webhook
    const webhook = await recreateWebhook(options.stripeSecretKey, {
      url: options.webhookUrl,
      events: options.events,
      description: options.description,
    })

    steps.push({
      step: 'Create webhook',
      success: true,
      message: `Created endpoint ${webhook.endpoint.id}`,
    })

    // Step 2: Update Vercel
    if (options.vercelCwd) {
      const envResult = await updateVercelEnv(
        'STRIPE_WEBHOOK_SECRET',
        webhook.secret,
        'production',
        options.vercelCwd
      )
      steps.push({
        step: 'Update Vercel env',
        success: envResult.success,
        message: envResult.message,
      })

      // Step 3: Trigger redeploy
      if (envResult.success) {
        const redeployResult = await triggerVercelRedeploy(options.vercelCwd)
        steps.push({
          step: 'Trigger redeploy',
          success: redeployResult.success,
          message: redeployResult.message,
        })
      }
    }

    return {
      success: steps.every(s => s.success),
      endpointId: webhook.endpoint.id,
      secret: webhook.secret,
      steps,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    steps.push({
      step: 'Setup failed',
      success: false,
      message,
    })

    return {
      success: false,
      steps,
    }
  }
}
