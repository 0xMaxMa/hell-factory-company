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
    return { address, bnb, bnb_usd, tokens: [], total_usd: bnb_usd }
  } catch (e) {
    return { address, bnb: '0', bnb_usd: '0', tokens: [], total_usd: '0', error: String(e) }
  }
}
