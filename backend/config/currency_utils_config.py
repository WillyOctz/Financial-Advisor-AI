import re
from typing import Tuple, Optional, Dict
from decimal import Decimal
import logging
import pandas as pd

logger = logging.getLogger(__name__)

EXCHANGE_RATES = {
    'USD': 1.0,
    'IDR': 17450.0,
}

CURRENCY_SYMBOL = {
    '$': 'USD',
    'USD': 'USD',
    'Rp': 'IDR',
    'IDR': 'IDR',
    'RP': 'IDR',
    'rupiah': 'IDR',
}

CURRENCY_PATTERNS = (
    # symbol before number: $1.234.56 or Rp.1.234.567 or Rp 1.234.567
    r'([€$£¥₱₫฿]|Rp\.?|RM|S\$)\s*([0-9]{1,3}(?:[,.]?[0-9]{3})*(?:[,.][0-9]{1,2})?)',
    
    # number before symbol: 1234.56 USD or 1.234.567 IDR
    r'([0-9]{1,3}(?:[,.]?[0-9]{3})*(?:[,.][0-9]{1,2})?)\s*([A-Z]{3}|rupiah)',
    
    # just number: 
    r'^([0-9]{1,3}(?:[,.]?[0-9]{3})*(?:[,.][0-9]{1,2})?)$'
)

class CurrencyDetector:
    """Detects currency from amount strings and converts to base currency (USD)"""

    def __init__(self, base_currency: str = 'USD', exchange_rates: Optional[Dict[str, float]] = None):
        self.base_currency = base_currency
        self.exchange_rates = exchange_rates or EXCHANGE_RATES
        
    def detect_currency_from_string(self, amount_str: str) -> Tuple[str, float, str]:
        """Detect currency from an amount string and extract the numeric value"""
        
        if not amount_str or pd.isna(amount_str):
            return (self.base_currency, 0.0, '')
        
        # convert to string and clean whitespace
        amount_str = str(amount_str).strip()
        
        # try pattern in order
        detected_currency = None
        numeric_part = None
        original_symbol = ''
        
        # pattern 1: symbol before number
        match = re.search(CURRENCY_PATTERNS[0], amount_str, re.IGNORECASE)
        if match:
            symbol = match.group(1)
            numeric_part = match.group(2)
            original_symbol = symbol
            detected_currency = CURRENCY_SYMBOL.get(symbol.upper().replace('.', ''), CURRENCY_SYMBOL.get(symbol.replace('.', ''), None))
            
            logger.debug(f"Pattern 1 matched: symbol={symbol}, numeric={numeric_part}, currency={detected_currency}")
            if detected_currency:
                try:
                    clean_number = self.parse_numeric_value(numeric_part, detected_currency)
                    logger.debug(f"Currency detected from symbol: {amount_str} -> {clean_number} {detected_currency}")
                    return (detected_currency, clean_number, original_symbol)
                except Exception as e:
                    logger.warning(f"Failed to parse with detected currency {detected_currency}: {e}")
            
        # pattern 2: number before symbol format   
        if not detected_currency:
            match = re.search(CURRENCY_PATTERNS[1], amount_str, re.IGNORECASE)
            if match:
                numeric_part = match.group(1)
                code = match.group(2)
                original_symbol = code
                detected_currency = CURRENCY_SYMBOL.get(code.upper(), None)
                
                if detected_currency:
                    try:
                        clean_number = self.parse_numeric_value(numeric_part, detected_currency)
                        logger.debug(f"Currency Pattern symbol before number were detected: {amount_str} -> {clean_number} {detected_currency}")
                        return (detected_currency, clean_number, original_symbol)
                    except Exception as e:
                        logger.warning(f"Failed to parse with detected currency {detected_currency}: {e}")
                
        if not detected_currency:
            match = re.search(CURRENCY_PATTERNS[2], amount_str)
            if match:
                numeric_part = match.group(1)
                # infer currency from number format
                detected_currency = self.infer_currency_from_format(numeric_part)
                original_symbol = ''
                
        # parse numeric value
        if numeric_part:
            try:
                # clean the number
                clean_number = self.parse_numeric_value(numeric_part, detected_currency)
                return (detected_currency or self.base_currency, clean_number, original_symbol)
            
            except Exception as e:
                logger.warning(f"Failed to parse numeric value '{numeric_part}': {e}")
                return (self.base_currency, 0.0, original_symbol)
            
        # if all fails, extract the number only
        try:
            clean_str = re.sub(r'[^\d.,\-]', '', amount_str)
            clean_number = self.parse_numeric_value(clean_str, self.base_currency)
            return (self.base_currency, clean_number, '')
        except:
            return (self.base_currency, 0.0, '')
        
    def parse_numeric_value(self, numeric_str: str, currency: str) -> float:
        """Parse numeric string considering different number formats"""
        numeric_str = numeric_str.strip()
        
        # count periods seperator to determine format
        period_count = numeric_str.count('.')
        comma_count = numeric_str.count(',')
        
        # determine decimal seperator based on currency
        if currency in ['IDR']:
            if comma_count > 0:
                numeric_str = numeric_str.replace('.', '') # remove thousand seperator
                numeric_str = numeric_str.replace(',', '.') # comma of decimal point 
            else:
                numeric_str = numeric_str.replace(',', '.')
        
        # USD and others currency format 
        else:
            if period_count > 1 and comma_count <= 1:
                logger.warning(f"USD currency but IDR format detected in '{numeric_str}', treating as IDR")
                if comma_count > 0:
                    numeric_str = numeric_str.replace('.', '')
                    numeric_str = numeric_str.replace(',', '.')
                else:
                    numeric_str = numeric_str.replace('.', '')
            else:
                numeric_str = numeric_str.replace(',', '')
                
        is_negative = numeric_str.startswith('-') or numeric_str.startswith('(')
        numeric_str = numeric_str.replace('(', '').replace(')', '').replace('-', '')
        
        # convert to float
        try:
            value = float(numeric_str)
            return -value if is_negative else value
        except ValueError as e:
            logger.error(f"Failed to convert '{numeric_str}' to float: {e}")
            raise
        
    def infer_currency_from_format(self, numeric_str: str) -> str:
        """Infer currency from number format when no symbol is present"""
        # checking IDR currency with periods as thousand seperators and comma
        if re.match(r'^[\d\.]+,\d{1,2}$', numeric_str) or (numeric_str.count('.') > 1 and ',' in numeric_str):
            return 'IDR'
        
        period_count = numeric_str.count('.')
        comma_count = numeric_str.count(',')
        
        # if multiple periods , likely IDR format
        if period_count >= 2:
            logger.info("Multiple periods detected -> IDR")
            return 'IDR'
        
        # period before comma = European/IDR format currencies
        if period_count > 0 and comma_count > 0:
            period_pos = numeric_str.rfind('.')
            comma_pos = numeric_str.rfind(',')
            if period_pos < comma_pos:
                logger.debug("Period before comma -> IDR")
                return 'IDR'
            
        # ends with comma + digits = IDR decimal (1.234,56 or 1234,56)
        if re.search(r',[0-9]{1,2}$', numeric_str):
            logger.debug("Ends with comma+digits -> IDR")
            return 'IDR'
        
        # ends with period + 2 digits and only one period = USD (1,234.56)
        if re.search(r'\.[0-9]{2}$', numeric_str) and period_count == 1:
            logger.debug("Single period at end with 2 decimals -> USD")
            return 'USD'
        
        logger.debug("No clear pattern, defaulting to USD")
        return 'USD'
     
    def convert_to_base_currency(self, amount: float, from_currency: str) -> float:
        """Convert amount from detected currency to base currency (USD)"""
        if from_currency == self.base_currency:
            return float(amount)
        
        rate = self.exchange_rates.get(from_currency)
        if not rate:
            logger.warning(f"Exchange rate not found for {from_currency}, defaulting to 1:1")
            
            return float(amount)
        
        # convert to base currency
        base_amount = float(amount) / rate
        
        logger.debug(f"Converted {amount} {from_currency} -> {base_amount} {self.base_currency} (rate: {rate})")
        return base_amount
    
    def process_amount_string(self, amount_str: str) -> Tuple[float, str, str]:
        """Complete processing: detect currency, parse amount, convert to base currency"""
        detected_currency, original_amount, original_symbol = self.detect_currency_from_string(amount_str)
        base_amount = self.convert_to_base_currency(original_amount, detected_currency)
        
        return (base_amount, detected_currency, original_symbol)
    
def detect_document_currency(dataframe, amount_column: str) -> str:
    """Analyze entire document to detect predominant currency Useful for documents where not every row has a currency symbol"""
    detector = CurrencyDetector()
    currency_counts = {}
    
    # sample up to 100 rows to determine currency
    sample_size = min(100, len(dataframe))
    sample_df = dataframe.head(sample_size)
    
    for _, row in sample_df.iterrows():
        amount_str = str(row.get(amount_column, ''))
        if amount_str and not pd.isna(amount_str):
            currency, _, _ = detector.detect_currency_from_string(amount_str)
            currency_counts[currency] = currency_counts.get(currency, 0) + 1
        
    # return most common currency
    if currency_counts:
        predominant_currency = max(currency_counts, key=currency_counts.get)
        logger.info(f"Document currency detected: {predominant_currency} ({currency_counts[predominant_currency]}/{sample_size} rows sampled)")
        return predominant_currency
    
    return 'USD'

# helper function for easy import
def parse_currency_amount(amount_str: str) -> Tuple[float, str, str]:
    """Convenience function to parse amount string"""
    detector = CurrencyDetector()
    return detector.process_amount_string(amount_str)