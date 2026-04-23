import fs from 'fs'
import path from 'path'
import { attributeJob } from './txAttribution'
import { getWorkspacePath } from './jobs'

const BSC_RPC = 'https://bsc-dataseed.binance.org/'
const HISTORY_PATH = path.join(process.cwd(), 'wallet_history.json')
const INCOMING_PATH = path.join(process.cwd(), 'incoming_transactions.json')

const TOKENS = [
  { symbol: 'BNB',  contract: null,                                          decimals: 18, priceSymbol: 'BNBUSDT' },
  { symbol: 'BTCB', contract: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, priceSymbol: 'BTCUSDT' },
  { symbol: 'ETH',  contract: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, priceSymbol: 'ETHUSDT' },
  { symbol: 'USDT', contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, priceSymbol: null },
  { symbol: 'USDC', contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, priceSymbol: null },
]

// Venus Protocol vToken contracts on BSC Mainnet
// vToken decimals = 8, underlying decimals = 18 → underlying = rawVToken * rawExchangeRate / 1e26
const VTOKENS = [
  { symbol: 'vBNB',  contract: '0xA07c5b74C9B40447a954e1466938b865b6BBea36', underlyingSymbol: 'BNB',  priceSymbol: 'BNBUSDT' },
  { symbol: 'vBTC',  contract: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847',  underlyingSymbol: 'BTC',  priceSymbol: 'BTCUSDT' },
  { symbol: 'vETH',  contract: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8',  underlyingSymbol: 'ETH',  priceSymbol: 'ETHUSDT' },
  { symbol: 'vUSDT', contract: '0xfD5840Cd36d94D7229439859C0112a4185BC0255', underlyingSymbol: 'USDT', priceSymbol: null },
  { symbol: 'vUSDC', contract: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8', underlyingSymbol: 'USDC', priceSymbol: null },
]

const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export interface TokenBalance {
  symbol: string
  balance: string
  price: number
  usd: string
}

export interface VTokenBalance {
  symbol: string
  underlyingSymbol: string
  underlyingAmount: string
  price: number
  usd: string
}

export interface WalletSnapshot {
  address: string
  tokens: TokenBalance[]
  venus: VTokenBalance[]
  total_usd: string
  error?: string
}

async function rpc(method: string, params: unknown[], id = 1): Promise<unknown> {
  const res = await fetch(BSC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  })
  const data = await res.json() as { result: unknown }
  return data.result
}

function balanceOfData(address: string): string {
  return `0x70a08231${address.slice(2).padStart(64, '0')}`
}

// exchangeRateStored() selector = 0x182df0f5
function exchangeRateStoredData(): string {
  return '0x182df0f5'
}

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {}
  const query = encodeURIComponent(JSON.stringify(symbols))
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${query}`)
  const data = await res.json() as Array<{ symbol: string; price: string }>
  return Object.fromEntries(data.map(d => [d.symbol, parseFloat(d.price)]))
}

export async function getMultiTokenBalance(address: string): Promise<WalletSnapshot> {
  if (!address) return { address, tokens: [], venus: [], total_usd: '0', error: 'Not configured' }

  try {
    const allPriceSymbols = [
      ...TOKENS.map(t => t.priceSymbol),
      ...VTOKENS.map(t => t.priceSymbol),
    ].filter((s, i, arr) => s !== null && arr.indexOf(s) === i) as string[]

    const [prices, ...rawResults] = await Promise.all([
      fetchPrices(allPriceSymbols),
      // wallet token balances
      ...TOKENS.map(t =>
        t.contract
          ? rpc('eth_call', [{ to: t.contract, data: balanceOfData(address) }, 'latest'])
          : rpc('eth_getBalance', [address, 'latest'])
      ),
      // vToken balances
      ...VTOKENS.map(t =>
        rpc('eth_call', [{ to: t.contract, data: balanceOfData(address) }, 'latest'])
      ),
      // vToken exchange rates
      ...VTOKENS.map(t =>
        rpc('eth_call', [{ to: t.contract, data: exchangeRateStoredData() }, 'latest'])
      ),
    ])

    const priceMap = prices as Record<string, number>
    const rawBalances = rawResults.slice(0, TOKENS.length)
    const rawVBalances = rawResults.slice(TOKENS.length, TOKENS.length + VTOKENS.length)
    const rawExchangeRates = rawResults.slice(TOKENS.length + VTOKENS.length)

    const tokens: TokenBalance[] = TOKENS.map((t, i) => {
      const raw = rawBalances[i] as string
      const balance = (parseInt(raw, 16) / Math.pow(10, t.decimals)).toFixed(6)
      const price = t.priceSymbol ? priceMap[t.priceSymbol] || 0 : 1.0
      const usd = (parseFloat(balance) * price).toFixed(2)
      return { symbol: t.symbol, balance, price, usd }
    })

    const venus: VTokenBalance[] = VTOKENS.map((t, i) => {
      const rawVBal = rawVBalances[i] as string | null
      const rawRate = rawExchangeRates[i] as string | null
      if (!rawVBal || rawVBal === '0x' || !rawRate || rawRate === '0x') return null
      // Venus vToken proxy contracts may return >32 bytes — take only first 32 bytes (word 0)
      // underlying (human) = rawVBal * rawRate / 1e36
      // Formula: vToken 8 dec + underlying 18 dec + exchangeRate mantissa 10 dec = 36 total
      try {
        const vBal = BigInt(rawVBal.slice(0, 66))
        const rate = BigInt(rawRate.slice(0, 66))
        const underlyingHuman = Number(vBal * rate / BigInt('1000000000000000000000000000000000000'))
        const underlyingAmount = underlyingHuman.toFixed(6)
        const price = t.priceSymbol ? priceMap[t.priceSymbol] || 0 : 1.0
        const usd = (underlyingHuman * price).toFixed(2)
        return { symbol: t.symbol, underlyingSymbol: t.underlyingSymbol, underlyingAmount, price, usd }
      } catch {
        return null
      }
    }).filter((v): v is VTokenBalance => v !== null && parseFloat(v.underlyingAmount) > 0)

    const walletUsd = tokens.reduce((sum, t) => sum + parseFloat(t.usd), 0)
    const venusUsd = venus.reduce((sum, v) => sum + parseFloat(v.usd), 0)
    const total_usd = (walletUsd + venusUsd).toFixed(2)

    return { address, tokens, venus, total_usd }
  } catch (e) {
    return { address, tokens: [], venus: [], total_usd: '0', error: String(e) }
  }
}

export function saveHistorySnapshotIfNeeded(total_usd: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  let history: Array<{ date: string; total_usd: number }> = []
  try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')) } catch { /* empty */ }
  if (history.find(e => e.date === today)) return false
  history.push({ date: today, total_usd: parseFloat(total_usd) || 0 })
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2))
  return true
}

export interface IncomingTx {
  hash: string
  from: string
  amount_usdt: string
  timestamp: number
  block: number
  job_name: string | null
  recorded_at: string
}

function loadIncoming(): IncomingTx[] {
  try { return JSON.parse(fs.readFileSync(INCOMING_PATH, 'utf-8')) } catch { return [] }
}

function saveIncoming(txs: IncomingTx[]) {
  fs.writeFileSync(INCOMING_PATH, JSON.stringify(txs, null, 2))
}

export async function detectAndSaveIncomingPayments(address: string): Promise<IncomingTx[]> {
  if (!address) return []
  try {
    const latestHex = await rpc('eth_blockNumber', []) as string
    const latest = parseInt(latestHex, 16)
    // BSC ~3s per block, 1hr = ~1200 blocks
    const fromBlock = `0x${(latest - 1200).toString(16)}`

    const logs = await rpc('eth_getLogs', [{
      fromBlock,
      toBlock: 'latest',
      address: USDT_CONTRACT,
      topics: [
        TRANSFER_TOPIC,
        null,
        `0x${address.slice(2).padStart(64, '0')}`,
      ],
    }]) as Array<{ transactionHash: string; topics: string[]; data: string; blockNumber: string }>

    if (!Array.isArray(logs) || logs.length === 0) return []

    const existing = loadIncoming()
    const existingHashes = new Set(existing.map(t => t.hash))
    const newTxs: IncomingTx[] = []

    const workspacePath = getWorkspacePath()
    const nowSec = Math.floor(Date.now() / 1000)

    for (const log of logs) {
      if (existingHashes.has(log.transactionHash)) continue
      const amount_usdt = (parseInt(log.data, 16) / 1e18).toFixed(6)
      const from = `0x${log.topics[1].slice(26)}`
      const block = parseInt(log.blockNumber, 16)
      const job_name = attributeJob(nowSec, workspacePath)
      newTxs.push({
        hash: log.transactionHash,
        from,
        amount_usdt,
        timestamp: nowSec,
        block,
        job_name,
        recorded_at: new Date().toISOString(),
      })
    }

    if (newTxs.length > 0) {
      saveIncoming([...existing, ...newTxs])
    }

    return newTxs
  } catch {
    return []
  }
}

export function getIncomingHistory(): IncomingTx[] {
  return loadIncoming()
}
