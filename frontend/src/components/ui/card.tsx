import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * CARD VARIANT 1: Glass Morphism (Modern & Professional)
 * Perfect for: Dashboards, Analytics, Modern Apps
 * Features: Frosted glass, backdrop blur, subtle borders
 */
export const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className={cn(
      "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl",
      "hover:border-white/20 hover:shadow-3xl transition-all duration-300",
      className,
    )}
    {...(props as any)}
  />
));
GlassCard.displayName = "GlassCard";

export const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-2 p-6 border-b border-white/10",
      className,
    )}
    {...props}
  />
));
GlassCardHeader.displayName = "GlassCardHeader";

export const GlassCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold text-white/90", className)}
    {...props}
  />
));
GlassCardTitle.displayName = "GlassCardTitle";

export const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6", className)} {...props} />
));
GlassCardContent.displayName = "GlassCardContent";

/**
 * CARD VARIANT 2: Gradient Border (Eye-catching & Modern)
 * Perfect for: Feature highlights, Premium sections, CTAs
 * Features: Animated gradient border, hover effects
 */
export const GradientBorderCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    gradientFrom?: string;
    gradientTo?: string;
  }
>(
  (
    {
      className,
      gradientFrom = "from-violet-500",
      gradientTo = "to-fuchsia-500",
      ...props
    },
    ref,
  ) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "relative rounded-2xl p-px bg-linear-to-br",
        gradientFrom,
        gradientTo,
        "shadow-2xl hover:shadow-3xl transition-all duration-300",
        className,
      )}
      {...(props as any)}
    >
      <div className="h-full rounded-2xl bg-slate-900 p-6">
        {props.children}
      </div>
    </motion.div>
  ),
);
GradientBorderCard.displayName = "GradientBorderCard";

/**
 * CARD VARIANT 3: Neon Glow (Futuristic & Bold)
 * Perfect for: Gaming, Tech products, Futuristic UIs
 * Features: Glowing borders, animated shadows
 */
export const NeonCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { glowColor?: string }
>(({ className, glowColor = "cyan", ...props }, ref) => {
  const glowColors = {
    cyan: "shadow-cyan-500/50 border-cyan-500/50 hover:shadow-cyan-400/70 hover:border-cyan-400/70",
    purple:
      "shadow-purple-500/50 border-purple-500/50 hover:shadow-purple-400/70 hover:border-purple-400/70",
    pink: "shadow-pink-500/50 border-pink-500/50 hover:shadow-pink-400/70 hover:border-pink-400/70",
    green:
      "shadow-emerald-500/50 border-emerald-500/50 hover:shadow-emerald-400/70 hover:border-emerald-400/70",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -6,
        transition: { duration: 0.3, type: "spring", stiffness: 300 },
      }}
      className={cn(
        "rounded-2xl border-2 bg-slate-900/90 backdrop-blur-sm",
        "shadow-2xl transition-all duration-300",
        glowColors[glowColor as keyof typeof glowColors] || glowColors.cyan,
        className,
      )}
      {...(props as any)}
    />
  );
});
NeonCard.displayName = "NeonCard";

/**
 * CARD VARIANT 4: Minimal Brutalist (Clean & Bold)
 * Perfect for: Content-focused apps, Blogs, Portfolios
 * Features: Sharp corners, strong borders, no shadows
 */
export const BrutalistCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{
      x: 4,
      y: -4,
      transition: { duration: 0.2 },
    }}
    className={cn(
      "rounded-none border-4 border-black bg-white shadow-[8px_8px_0_0_#000]",
      "hover:shadow-[12px_12px_0_0_#000] transition-all duration-200",
      className,
    )}
    {...(props as any)}
  />
));
BrutalistCard.displayName = "BrutalistCard";

/**
 * CARD VARIANT 5: Neumorphism (Soft & Elegant)
 * Perfect for: Light themes, Elegant UIs, Soft designs
 * Features: Soft shadows, subtle depth, pressed effect on hover
 */
export const NeumorphicCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{
      scale: 0.98,
      transition: { duration: 0.2 },
    }}
    className={cn(
      "rounded-3xl bg-gray-100",
      "shadow-[8px_8px_16px_#d1d1d1,-8px_-8px_16px_#ffffff]",
      "hover:shadow-[inset_4px_4px_8px_#d1d1d1,inset_-4px_-4px_8px_#ffffff]",
      "transition-all duration-300",
      className,
    )}
    {...(props as any)}
  />
));
NeumorphicCard.displayName = "NeumorphicCard";

/**
 * CARD VARIANT 6: 3D Perspective (Dynamic & Interactive)
 * Perfect for: Interactive elements, Games, Product showcases
 * Features: 3D tilt on hover, perspective transforms
 */
export const Perspective3DCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const [rotateX, setRotateX] = React.useState(0);
  const [rotateY, setRotateY] = React.useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setRotateY(((x - centerX) / centerX) * 10);
    setRotateX(((centerY - y) / centerY) * 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div style={{ perspective: "1000px" }}>
      <motion.div
        ref={ref}
        animate={{
          rotateX,
          rotateY,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm",
          "shadow-2xl hover:shadow-3xl transition-shadow duration-300",
          className,
        )}
        style={{
          transformStyle: "preserve-3d",
        }}
        {...(props as any)}
      />
    </div>
  );
});
Perspective3DCard.displayName = "Perspective3DCard";

/**
 * CARD VARIANT 7: Layered Shadow (Depth & Dimension)
 * Perfect for: Cards that need to stand out, Important sections
 * Features: Multiple shadow layers, vibrant colors
 */
export const LayeredShadowCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { shadowColor?: string }
>(({ className, shadowColor = "violet", ...props }, ref) => {
  const shadowColors = {
    violet:
      "shadow-[0_10px_30px_-5px_rgba(139,92,246,0.3),0_4px_10px_-2px_rgba(139,92,246,0.2)]",
    cyan: "shadow-[0_10px_30px_-5px_rgba(6,182,212,0.3),0_4px_10px_-2px_rgba(6,182,212,0.2)]",
    pink: "shadow-[0_10px_30px_-5px_rgba(236,72,153,0.3),0_4px_10px_-2px_rgba(236,72,153,0.2)]",
    orange:
      "shadow-[0_10px_30px_-5px_rgba(249,115,22,0.3),0_4px_10px_-2px_rgba(249,115,22,0.2)]",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -8,
        transition: { duration: 0.3, type: "spring", stiffness: 300 },
      }}
      className={cn(
        "rounded-2xl border border-slate-700/50 bg-slate-900",
        "transition-all duration-300",
        shadowColors[shadowColor as keyof typeof shadowColors] ||
          shadowColors.violet,
        className,
      )}
      {...(props as any)}
    />
  );
});
LayeredShadowCard.displayName = "LayeredShadowCard";

/**
 * CARD VARIANT 8: Holographic (Futuristic & Premium)
 * Perfect for: Premium features, Special offers, High-end products
 * Features: Rainbow gradient overlay, shifting colors
 */
export const HolographicCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    className={cn(
      "relative rounded-2xl border border-transparent bg-slate-900 overflow-hidden",
      "before:absolute before:inset-0 before:rounded-2xl before:p-0.5",
      "before:bg-linear-to-r before:from-pink-500 before:via-violet-500 before:to-cyan-500",
      "before:animate-[gradient_3s_ease_infinite]",
      "after:absolute after:inset-0.5 after:rounded-2xl after:bg-slate-900",
      "shadow-2xl hover:shadow-3xl transition-all duration-300",
      className,
    )}
    {...(props as any)}
  >
    <div className="relative z-10">{props.children}</div>
  </motion.div>
));
HolographicCard.displayName = "HolographicCard";

// For globals.css
/*
@keyframes gradient {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
*/

// basic card design
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-500", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription";

export { Card, CardHeader, CardTitle, CardContent, CardDescription };
