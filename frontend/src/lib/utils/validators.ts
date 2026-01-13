/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate file type
 */
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.some(type => {
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    return file.type.includes(type.replace('.', ''));
  });
};

/**
 * Validate file size
 */
export const isValidFileSize = (file: File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validate amount (positive number)
 */
export const isValidAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount > 0;
};

/**
 * Validate date string
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

/**
 * Validate transaction type
 */
export const isValidTransactionType = (type: string): boolean => {
  return ['income', 'expense'].includes(type.toLowerCase());
};

/**
 * Validate required fields
 */
export const validateRequired = (value: any): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

/**
 * Validate column mapping
 */
export const validateColumnMapping = (mapping: Record<string, string>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!mapping.date) errors.push('Date column is required');
  if (!mapping.amount) errors.push('Amount column is required');
  if (!mapping.description) errors.push('Description column is required');
  if (!mapping.type) errors.push('Type column is required');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};