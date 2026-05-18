import React, { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Banknote, Check, Loader2 } from "lucide-react";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { CurrencyCode, CURRENCIES } from "@/lib/utils/currency";
import { toast, Toaster } from "react-hot-toast";

const CurrencySwitcher: React.FC = () => {
  const { currency, isLoading, setCurrency } = useCurrency();
  const [updating, setUpdating] = useState(false);

  const handleCurrencyChange = async (newCurrency: CurrencyCode) => {
    if (currency === newCurrency || updating) return;

    setUpdating(true);
    try {
      await setCurrency(newCurrency);

      toast.success("Currency has been changed.");
    } catch (error) {
      console.error("Failed to change currency:", error);

      toast.error("Currency set is error, Please try again later!");
    } finally {
      setUpdating(false);
    }
  };

  const currencyOptions: Array<{
    code: CurrencyCode;
    icon: typeof DollarSign;
    color: string;
  }> = [
    {
      code: "USD",
      icon: DollarSign,
      color: "from-green-500 to-emerald-500",
    },
    {
      code: "IDR",
      icon: Banknote,
      color: "from-red-500 to-rose-500",
    },
  ];

  return (
    <div className="bg-slate-800/30 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Currency Preference
        </h3>
        <p className="text-sm text-slate-400">
          Choose your preferred currency for displaying financial data
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currencyOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = currency === option.code;
          const config = CURRENCIES[option.code];

          return (
            <motion.button
              key={option.code}
              onClick={() => handleCurrencyChange(option.code)}
              disabled={updating || isLoading}
              whileHover={!isSelected ? { scale: 1.02 } : {}}
              whileTap={!isSelected ? { scale: 0.98 } : {}}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200
                ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-700/50"
                }
                ${updating || isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}

              <div className="flex items-center gap-3">
                {/* Currency Icon */}
                <div
                  className={`
                  w-12 h-12 rounded-lg bg-linear-to-br ${option.color} 
                  flex items-center justify-center
                `}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Currency Info */}
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white flex items-center gap-2">
                    {config.code}
                    {updating && currency === option.code && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  <div className="text-sm text-slate-400">{config.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Symbol: {config.symbol}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Exchange Rate Info */}
      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
        <p className="text-xs text-slate-400 mb-1">Current Exchange Rate</p>
        <p className="text-sm text-white font-medium">1 USD ≈ 17,450 IDR</p>
        <p className="text-xs text-slate-500 mt-1">
          Note: All stored amounts remain in USD. Display will convert to your
          preferred currency.
        </p>
      </div>
    </div>
  );
};

export default CurrencySwitcher;
