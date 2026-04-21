import fs from 'fs'
import path from 'path'

function saveHistorySnapshot(total_usd: string) {
  const historyPath = path.join(process.cwd(), 'wallet_history.json')
  const today = new Date().toISOString().slice(0, 10)
  let history: Array<{ date: string; total_usd: number }> = []
  try { history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')) } catch { /* empty */ }
  if (!history.find(e => e.date === today)) {
    history.push({ date: today, total_usd: parseFloat(total_usd) || 0 })
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))
  }
}

export async function getWalletBalance(address: string, apiKey: string) {
  if (!address || !apiKey) {
    return { address, bnb: '0', bnb_usd: '0', tokens: [], total_usd: '0', error: 'Not configured' }
  }
  try {
    const [bnbRes, bnbPriceRes] = await Promise.all([
      fetch(`https://api.bscscan.com/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`),
      fetch(`https://api.bscscan.com/api?module=stats&action=bnbprice&apikey=${apiKey}`),
    ])
    const bnbData = await bnbRes.json()
    const priceData = await bnbPriceRes.json()
    const bnb = (Number(bnbData.result) / 1e18).toFixed(4)
    const bnbPrice = Number(priceData.result?.ethusd || 0)
    const bnb_usd = (Number(bnb) * bnbPrice).toFixed(2)
    const total_usd = bnb_usd
    saveHistorySnapshot(total_usd)
    return { address, bnb, bnb_usd, tokens: [], total_usd, bnb_price: bnbPrice.toFixed(2) }
  } catch (e) {
    return { address, bnb: '0', bnb_usd: '0', tokens: [], total_usd: '0', error: String(e) }
  }
}

export async function getTransactions(address: string, apiKey: string) {
  if (!address || !apiKey) return []
  try {
    const res = await fetch(
      `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=20&apikey=${apiKey}`
    )
    const data = await res.json()
    if (!Array.isArray(data.result)) return []
    return data.result.filter((tx: { to: string }) => tx.to?.toLowerCase() === address.toLowerCase())
  } catch {
    return []
  }
}
