import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Text, View } from 'react-native';
import { simulatePayoff } from '@tyche/core';
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
    }, { strategy: 'snowball' });
    return (_jsxs(View, { style: { padding: 24 }, children: [_jsx(Text, { style: { fontSize: 24, fontWeight: '600' }, children: "Tyche Mobile" }), _jsxs(Text, { children: ["Months to debt free: ", result.monthsToDebtFree] }), _jsxs(Text, { children: ["Total interest: $", result.totalInterest.toFixed(2)] })] }));
}
//# sourceMappingURL=App.js.map