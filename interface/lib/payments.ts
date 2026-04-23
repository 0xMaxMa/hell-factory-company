import fs from 'fs'
import path from 'path'

const PAYMENTS_PATH = path.join(process.cwd(), 'payments.json')

export interface Payment {
  id: string
  date: string
  agentId: string
  job: string
  token: string
  amount: string
}

export function loadPayments(): Payment[] {
  try { return JSON.parse(fs.readFileSync(PAYMENTS_PATH, 'utf-8')) } catch { return [] }
}

export function recordPayment(data: Omit<Payment, 'id' | 'date'>): Payment {
  const payments = loadPayments()
  const payment: Payment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
    ...data,
  }
  payments.push(payment)
  fs.writeFileSync(PAYMENTS_PATH, JSON.stringify(payments, null, 2))
  return payment
}
