import React from 'react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
      base: 'bg-black dark:bg-white',
      eclipse: 'bg-white dark:bg-black'
    },
    teacher: {
      base: 'bg-gold',
      eclipse: 'bg-royal-red'
    }
  };

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center", sizes[size], className)}>
      {/* The Base Dot */}
      <div className={cn("absolute inset-0 rounded-full", colors[variant].base)} />
      
      {/* The Eclipse Dot */}
      <motion.div 
        initial={{ x: '12.5%', y: '12.5%' }}
        animate={animate ? { 
          x: ['12.5%', '6%', '12.5%'],
          y: ['12.5%', '9%', '12.5%']
        } : { x: '12.5%', y: '12.5%' }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className={cn("absolute inset-0 rounded-full", colors[variant].eclipse)} 
      />
    </div>
  );
}
