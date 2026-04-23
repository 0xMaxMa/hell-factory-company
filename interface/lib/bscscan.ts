// Re-exports for backward compatibility — use lib/walletBalance.ts directly for new code
export { getMultiTokenBalance as getWalletBalance, saveHistorySnapshotIfNeeded } from './walletBalance'

export async function getTransactions(_address: string) {
  return []
}
