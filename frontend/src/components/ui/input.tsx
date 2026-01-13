import React from "react";

export type SimpleInputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "textarea"
  | "select"
  | "date";

export interface Option {
  value: string;
  label: string;
}

export interface SimpleInputProps
  extends Omit<
    React.InputHTMLAttributes<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
    "size"
  > {
  type?: SimpleInputType;
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  options?: Option[];
}

const Input: React.FC<SimpleInputProps> = ({
  type = "text",
  label,
  helperText,
  error,
  success = false,
  required = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  options = [],
  ...props
}) => {
  const sizeClasses = "px-3 py-2 text-base";

  const variantClasses = `border ${
    error
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : success
      ? "border-green-500 focus:border-green-500 focus:ring-green-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
  } bg-white`;

  const inputClasses = `
    ${sizeClasses}
    ${variantClasses}
    ${fullWidth ? "w-full" : ""}
    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
    rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-opacity-20
    ${leftIcon ? "pl-10" : ""}
    ${rightIcon ? "pr-10" : ""}
    ${className}
  `.trim();

  const renderInput = () => {
    if (type === "textarea") {
      return (
        <textarea
          disabled={disabled}
          required={required}
          className={`${inputClasses} min-h-[100px] resize-y`}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      );
    }

    if (type === "select") {
      return (
        <select
          disabled={disabled}
          required={required}
          className={inputClasses}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={type}
        disabled={disabled}
        required={required}
        className={inputClasses}
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  };

  return (
    <div className={`${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label className="block mb-1 text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}

        {renderInput()}

        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>

      {(helperText || error) && (
        <p
          className={`mt-1 text-sm ${
            error
              ? "text-red-600"
              : success
              ? "text-green-600"
              : "text-gray-500"
          }`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
