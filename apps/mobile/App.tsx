import React from 'react'
import { Text, View } from 'react-native'
import { simulatePayoff } from '@tyche/core'

export default function App() {
  const result = simulatePayoff({
    monthlyBudget: 300,
    cards: [
      { 
        id: 'm1', 
        name: 'Mobile Card', 
        network: 'Visa',
        lastFourDigits: '4532',
        limit: 6000, 
        balance: 2000, 
        apr: 0.2299, 
        minPayment: 50, 
        dueDayOfMonth: 12 
      }
    ]
  }, { strategy: 'snowball' })

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>Tyche Mobile</Text>
      <Text>Months to debt free: {result.monthsToDebtFree}</Text>
      <Text>Total interest: ${result.totalInterest.toFixed(2)}</Text>
    </View>
  )
}
