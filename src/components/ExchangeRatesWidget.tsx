"use client";

import { useState, useEffect } from "react";
import { Banknote } from "lucide-react";

// Fallback rates (approximate) if API fails
const FALLBACK_RATES: Record<string, number> = {
  USD: 325,
  EUR: 350,
  GBP: 410,
};

type Rates = { base: string; rates: Record<string, number> } | null;

export function ExchangeRatesWidget() {
  const [rates, setRates] = useState<Rates>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRates() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          "https://api.frankfurter.app/latest?from=LKR&to=USD,EUR,GBP",
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          // Convert from "1 LKR = X USD" to "1 USD = X LKR"
          const inverted: Record<string, number> = {};
          for (const [currency, value] of Object.entries(data.rates)) {
            inverted[currency] = Math.round(1 / (value as number));
          }
          setRates({ base: "LKR", rates: inverted });
        } else {
          throw new Error("API failed");
        }
      } catch {
        setRates({
          base: "LKR",
          rates: FALLBACK_RATES,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchRates();
  }, []);

  const displayRates = rates?.rates ?? FALLBACK_RATES;
  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
  ];

  return (
    <div className="rounded-2xl border border-white/20 bg-white/40 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      <div className="flex items-center gap-2 pb-3 border-b border-white/30">
        <Banknote className="h-5 w-5 text-teal-600" />
        <h3 className="font-semibold text-slate-900">Exchange Rates</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        1 currency unit → LKR (Sri Lankan Rupee)
      </p>
      <div className="mt-4 space-y-3">
        {currencies.map(({ code, symbol, name }) => (
          <div
            key={code}
            className="flex items-center justify-between rounded-xl bg-white/50 px-4 py-3 backdrop-blur-sm"
          >
            <div>
              <p className="font-medium text-slate-900">
                {symbol} {code}
              </p>
              <p className="text-xs text-slate-500">{name}</p>
            </div>
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {loading ? (
                <span className="animate-pulse">---</span>
              ) : (
                displayRates[code]?.toLocaleString() ?? "—"
              )}{" "}
              <span className="text-slate-500 text-sm">LKR</span>
            </span>
          </div>
        ))}
      </div>
      {!loading && (
        <p className="mt-3 text-xs text-slate-400">
          Rates may vary. Check with your bank.
        </p>
      )}
    </div>
  );
}
