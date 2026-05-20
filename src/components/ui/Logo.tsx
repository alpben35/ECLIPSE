import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'student' | 'teacher';
  className?: string;
  animate?: boolean;
}

export default function Logo({ 
  size = 'md', 
  variant = 'student',
  className, 
  animate = true 
}: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-32 h-32'
  };

  const colors = {
    student: {
      light: { base: 'bg-black', glow: 'bg-black/10' }, 
      dark: { base: 'bg-white', glow: 'bg-white/30' },
      glow: 'bg-black/10 dark:bg-white/20'
    },
    teacher: {
      base: 'bg-gold',
      eclipse: 'bg-royal-red', 
      glow: 'bg-gold/50' 
    }
  };

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center transition-all", sizes[size], className)}>
      {/* Corona / Glow Effect */}
      <motion.div
        animate={animate ? {
          scale: [1, 1.25, 1],
          opacity: [0.3, 0.6, 0.3],
        } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "absolute inset-[-25%] rounded-full blur-xl transition-all duration-500",
          variant === 'teacher' ? colors.teacher.glow : colors.student.glow
        )}
      />

      {/* The Base Circle */}
      <div className={cn(
        "absolute inset-0 rounded-full z-10 transition-colors duration-500 shadow-2xl",
        variant === 'teacher' 
          ? colors.teacher.base 
          : "bg-black dark:bg-white"
      )} />
      
      {/* The Eclipse Circle */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full z-20 scale-95 transition-all duration-500",
          variant === 'teacher'
            ? cn("translate-x-[11%]", colors.teacher.eclipse)
            : "translate-x-[9%] bg-white dark:bg-black block"
        )}
      />
    </div>
  );
}


