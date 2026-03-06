/**
 * Environment Variable Resolver
 *
 * @deprecated This module is kept for backwards compatibility only.
 * Now uses plain .env files - just set API keys in .env.local.
 * No 1Password CLI or env-resolver needed for new projects.
 *
 * Legacy features (kept for existing projects):
 * - Handles 1Password references and provides resilient API key resolution
 * - Supports multiple fallback sources and caching for offline use
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Cache directory for resolved keys (excluded from git)
const CACHE_DIR = path.join(os.homedir(), '.saas-utils', 'cache')
const KEY_CACHE_FILE = path.join(CACHE_DIR, 'api-keys.json')

// 1Password placeholder pattern: [use 'op item get ...' to reveal]
const OP_PLACEHOLDER_PATTERN = /^\[use 'op item get ([^']+)'/

/**
 * Parse env var value from a content string using simple parsing
 * Avoids dynamic regex for security
 */
function parseEnvValue(content: string, keyName: string): string | null {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(keyName + '=')) {
      let value = trimmed.slice(keyName.length + 1)
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
}

interface KeyCache {
  [key: string]: {
    value: string
    timestamp: number
    source: string
  }
}

/**
 * Check if a value is a 1Password placeholder
 */
export function isOpPlaceholder(value: string): boolean {
  return OP_PLACEHOLDER_PATTERN.test(value)
}

/**
 * Extract the 1Password item reference from a placeholder
 */
export function extractOpReference(placeholder: string): string | null {
  const match = placeholder.match(OP_PLACEHOLDER_PATTERN)
  return match ? match[1] : null
}

/**
 * Resolve a 1Password item using the `op` CLI
 */
export function resolveOpItem(itemRef: string): string | null {
  try {
    // Check if op CLI is available
    execFileSync('op', ['--version'], { stdio: 'ignore' })

    // Try to get the item - this will prompt for auth if needed
    const result = execFileSync(
      'op',
      ['item', 'get', itemRef, '--reveal', '--format', 'json'],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    const item = JSON.parse(result)

    // Find the password/credential field
    const credField = item.fields?.find(
      (f: { type?: string; label?: string }) =>
        f.type === 'CONCEALED' || f.label?.toLowerCase().includes('key')
    )

    if (credField?.value) {
      return credField.value
    }

    // Fallback to looking for specific field labels
    const apiKeyField = item.fields?.find(
      (f: { label?: string }) =>
        f.label === 'credential' ||
        f.label === 'api_key' ||
        f.label === 'API Key'
    )

    return apiKeyField?.value || null
  } catch (error) {
    // Distinguish between "op CLI not installed" and "op CLI failed"
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`⚠  1Password resolution failed: ${errorMessage}`)
    return null
  }
}

/**
 * Load cached keys from disk
 */
function loadKeyCache(): KeyCache {
  try {
    if (fs.existsSync(KEY_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(KEY_CACHE_FILE, 'utf8'))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`⚠  API key cache corrupted: ${errorMessage}`)
    // Start with fresh cache
  }
  return {}
}

/**
 * Save key to cache
 */
function saveToCache(keyName: string, value: string, source: string): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    const cache = loadKeyCache()
    cache[keyName] = {
      value,
      timestamp: Date.now(),
      source,
    }
    fs.writeFileSync(KEY_CACHE_FILE, JSON.stringify(cache, null, 2))
    fs.chmodSync(KEY_CACHE_FILE, 0o600) // Restrict permissions
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`⚠  Cache write failed: ${errorMessage}`)
    // Continue without caching
  }
}

/**
 * Get key from cache if it exists and is recent (< 24 hours)
 */
function getFromCache(keyName: string): string | null {
  const cache = loadKeyCache()
  const entry = cache[keyName]

  if (entry) {
    const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60)
    if (ageHours < 24) {
      return entry.value
    }
  }

  return null
}

/**
 * Resolve an API key with multiple fallback sources
 *
 * Resolution order:
 * 1. Direct environment variable (if it's a real key)
 * 2. Cached value (from previous successful resolution)
 * 3. 1Password resolution (if placeholder detected)
 * 4. Common environment files (.env, .env.local)
 */
export function resolveApiKey(
  keyName: string,
  options: { silent?: boolean; allowCwdEnv?: boolean } = {}
): string | null {
  const { silent = false, allowCwdEnv = false } = options

  // 1. Check current environment
  const envValue = process.env[keyName]

  if (envValue && !isOpPlaceholder(envValue)) {
    // It's a real key, use it and cache it
    if (envValue.startsWith('sk-ant-') || envValue.length > 20) {
      saveToCache(keyName, envValue, 'environment')
      return envValue
    }
  }

  // 2. Check cache
  const cachedValue = getFromCache(keyName)
  if (cachedValue) {
    if (!silent) {
      console.log(`Using cached ${keyName} (run 'auth refresh' to update)`)
    }
    // Update the environment so downstream code can use it
    process.env[keyName] = cachedValue
    return cachedValue
  }

  // 3. Try 1Password resolution
  if (envValue && isOpPlaceholder(envValue)) {
    const itemRef = extractOpReference(envValue)
    if (itemRef) {
      if (!silent) {
        console.log(`Resolving ${keyName} from 1Password...`)
      }

      const resolved = resolveOpItem(itemRef)
      if (resolved) {
        saveToCache(keyName, resolved, '1password')
        process.env[keyName] = resolved
        return resolved
      }

      if (!silent) {
        console.log(
          `Could not resolve from 1Password. Run: op item get ${itemRef} --reveal`
        )
      }
    }
  }

  // 4. Try common .env file locations
  const envFiles = [
    ...(allowCwdEnv
      ? [
          path.join(process.cwd(), '.env'),
          path.join(process.cwd(), '.env.local'),
        ]
      : []),
    path.join(os.homedir(), '.env'),
  ]

  for (const envFile of envFiles) {
    try {
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf8')
        const value = parseEnvValue(content, keyName)
        if (value && !isOpPlaceholder(value)) {
          if (value.startsWith('sk-ant-') || value.length > 20) {
            saveToCache(keyName, value, envFile)
            process.env[keyName] = value
            return value
          }
        }
      }
    } catch (error) {
      // Skip unreadable files (logged for debugging)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code !== 'ENOENT'
      ) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.warn(`⚠  Unexpected error: ${errorMessage}`)
      }
    }
  }

  return null
}

/**
 * Ensure required API keys are available, with helpful error messages
 */
export function ensureApiKeys(
  required: string[],
  options: { silent?: boolean } = {}
): { success: boolean; missing: string[] } {
  const missing: string[] = []

  for (const keyName of required) {
    const resolved = resolveApiKey(keyName, options)
    if (!resolved) {
      missing.push(keyName)
    }
  }

  return {
    success: missing.length === 0,
    missing,
  }
}

/**
 * Print helpful instructions for missing keys
 */
export function printKeySetupInstructions(keyName: string): void {
  console.log(`
To set up ${keyName}:

1. Export directly:
   export ${keyName}=sk-ant-...

2. Add to .env.local:
   echo "${keyName}=sk-ant-..." >> .env.local

3. Use 1Password CLI (recommended):
   op item get <item-id> --reveal
   # Then export the value

4. Cache a key for offline use:
   auth set ${keyName}
`)
}

export default {
  resolveApiKey,
  ensureApiKeys,
  isOpPlaceholder,
  printKeySetupInstructions,
}
