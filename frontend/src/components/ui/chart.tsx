import React from "react";
import { cn } from "@/lib/utils";

interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: { name: string; value: number }[];
  variant?: "line" | "bar" | "area";
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ className, data, variant = "bar", ...props }, ref) => {
    const maxValue = Math.max(...data.map((item) => item.value));

    return (
      <div
        ref={ref}
        className={cn(
          "w-full h-64 bg-white rounded-lg border border-gray-200 p-4",
          className
        )}
        {...props}
      >
        <div className="flex items-end justify-between h-48 gap-2">
          {data.map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs text-gray-500 mb-1">{item.name}</div>
              <div
                className={cn(
                  "w-full transition-all duration-300 ease-in-out",
                  {
                    "bg-blue-500 rounded-t": variant === "bar",
                    "bg-transparent border-b-2 border-blue-500":
                      variant === "line",
                    "bg-gradient-to-t from-blue-400 to-blue-100 rounded-t":
                      variant === "area",
                  }
                )}
                style={{ height: `${(item.value / maxValue) * 100}%`}}
              />
              <div className="text-xs text-gray-700 mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

Chart.displayName = "Chart";

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("w-full bg-white rounded-lg border border-gray-200 p-6", className)}
    {...props}
  />
));
ChartContainer.displayName = "ChartContainer";

const ChartHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 pb-4", className)}
    {...props}
  />
));
ChartHeader.displayName = "ChartHeader";

const ChartTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold text-gray-900", className)}
    {...props}
  />
));
ChartTitle.displayName = "ChartTitle";

const ChartContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-2", className)}
    {...props}
  />
));
ChartContent.displayName = "ChartContent";

export { Chart, ChartContainer, ChartHeader, ChartTitle, ChartContent };
