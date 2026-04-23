import { execSync } from 'child_process'

const SCRIPT = '/home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/get_address.py'

export function getWalletAddressFromScript(): string {
  try {
    const out = execSync(`python3 ${SCRIPT}`, { timeout: 5000, encoding: 'utf-8' }).trim()
    if (out.startsWith('ADDRESS:')) return out.replace('ADDRESS:', '')
  } catch { /* no wallet */ }
  return ''
}
