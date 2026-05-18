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
      light: { base: 'bg-black', eclipse: 'hidden' }, 
      dark: { base: 'bg-white', eclipse: 'bg-zinc-950' },
      glow: 'bg-blue-500/20 dark:bg-white/20'
    },
    teacher: {
      base: 'bg-gold',
      eclipse: 'bg-royal-red',
      glow: 'bg-gold/30'
    }
  };

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center", sizes[size], className)} id="app-logo">
      {/* Corona / Glow Effect */}
      <motion.div
        animate={animate ? {
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
        } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "absolute inset-[-10%] rounded-full blur-lg transition-all duration-500",
          variant === 'teacher' ? colors.teacher.glow : colors.student.glow
        )}
      />

      {/* The Base Circle */}
      <div className={cn(
        "absolute inset-0 rounded-full z-10 transition-colors duration-500 shadow-lg",
        variant === 'teacher' 
          ? colors.teacher.base 
          : "bg-black dark:bg-white"
      )} />
      
      {/* The Eclipse Circle */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full z-20 scale-95 transition-all duration-500",
          variant === 'teacher'
            ? "translate-x-[15%] " + colors.teacher.eclipse
            : "hidden dark:block translate-x-[15%] bg-zinc-950"
        )}
      />
    </div>
  );
}
