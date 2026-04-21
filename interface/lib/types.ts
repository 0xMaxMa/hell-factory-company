export interface JobWorkspace {
  name: string
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

export interface WalletBalance {
  address: string
  bnb: string
  bnb_usd: string
  tokens: Array<{ symbol: string; balance: string; usd: string }>
  total_usd: string
  error?: string
}

export interface AppConfig {
  gatewayUrl: string
  apiKey: string
  agentId: string
  bscscanApiKey: string
  workspacePath: string
  maxConcurrent: number
  autoRun: boolean
}

export interface WalletHistoryEntry {
  date: string
  total_usd: number
}

export interface Transaction {
  hash: string
  from: string
  value_bnb: string
  timestamp: number
  job_name: string | null
}
