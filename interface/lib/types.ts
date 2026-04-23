export interface JobWorkspace {
  name: string
  slug: string
  job_id?: string
  title?: string
  description: string
  category: string
  status: string
  created_at: string
  estimated_earnings: string | object
  risk_level: string
  run_count?: number
  total_earnings?: string
  last_run?: string | null
  enabled?: boolean
}

export interface GatewaySession {
  session_id: string
  agent_id: string
  started_at: string
  last_message_at: string
}

export interface GatewayStatus {
  agents: Array<{
    id: string
    sessions: GatewaySession[]
  }>
}

export interface TokenBalance {
  symbol: string
  balance: string
  price: number
  usd: string
}

export interface WalletBalance {
  address: string
  tokens: TokenBalance[]
  total_usd: string
  error?: string
}

export interface AppConfig {
  gatewayUrl: string
  apiKey: string
  agentId: string
  workspacePath: string
  maxConcurrent: number
  autoRun: boolean
}

export interface WalletHistoryEntry {
  date: string
  total_usd: number
}

export interface Payment {
  id: string
  date: string
  agentId: string
  job: string
  token: string
  amount: string
}
