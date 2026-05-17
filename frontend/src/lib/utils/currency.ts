export type CurrencyCode = "USD" | "IDR";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  decimalPlaces: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    locale: "en-US",
    decimalPlaces: 2,
  },
  IDR: {
    code: "IDR",
    symbol: "Rp",
    name: "Indonesian Rupiah",
    locale: "id-ID",
    decimalPlaces: 0,
  },
};

// current exchange rate will be fixed with API once worked
const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  IDR: 17450,
};

// format amount to specified currency
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "USD",
  options?: {
    showSymbol?: boolean;
    compact?: boolean;
  },
): string {
  const config = CURRENCIES[currency];
  const { showSymbol = true, compact = false } = options || {};

  const convertedAmount = convertCurrency(amount, "USD", currency);

  const formattedAmount = new Intl.NumberFormat(config.locale, {
    style: showSymbol ? "currency" : "decimal",
    currency: config.code,
    minimumFractionDigits: compact ? 0 : config.decimalPlaces,
    maximumFractionDigits: compact ? 0 : config.decimalPlaces,
    notation: compact ? "compact" : "standard",
  }).format(convertedAmount);

  return formattedAmount;
}

// convert from one currency to another
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): number {
  if (fromCurrency === toCurrency) return amount;

  // convert to USD first (base currency)
  const amountInUSD = amount / EXCHANGE_RATES[fromCurrency];

  // convert from USD to target currency
  const convertedAmount = amountInUSD * EXCHANGE_RATES[toCurrency];

  return convertedAmount;
}

// parse currency string to number
export function parseCurrencyString(
  value: string,
  currency: CurrencyCode = "USD",
): number {
  const config = CURRENCIES[currency];

  // remove currency symbols and formatting
  const cleanValue = value
    .replace(config.symbol, "")
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "");

  return parseFloat(cleanValue) || 0;
}

// get exchange rate between two currencies
export function getExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): number {
  if (fromCurrency === toCurrency) return 1;

  return EXCHANGE_RATES[toCurrency] / EXCHANGE_RATES[fromCurrency];
}

// format amount with compact notation (1K, 1M or etc.)
export function formatCompactCurrency(
  amount: number,
  currency: CurrencyCode = "USD",
): string {
  return formatCurrency(amount, currency, { compact: true });
}

// (this need to be changed with real time API for the rates, for now it will be fixed)
export function updateExchangeRates(
  rates: Partial<Record<CurrencyCode, number>>,
): void {
  Object.assign(EXCHANGE_RATES, rates);
}

// get current exchange rates
export function getCurrentExchangeRates(): Record<CurrencyCode, number> {
  return { ...EXCHANGE_RATES };
}

// fetch live exchange rates from an API (from exchangerate-api.com or something related), for now it will be fixed for testing
export async function fetchLiveExchangeRates(): Promise<
  Record<CurrencyCode, number>
> {
  try {
    // API call for the exhange rate here later

    return getCurrentExchangeRates();
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    return getCurrentExchangeRates();
  }
}
