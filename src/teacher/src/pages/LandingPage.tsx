import React, { useContext } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Users, BarChart2, Shield, Zap, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '@/components/ui/Logo';
import { ThemeContext } from '@/lib/contexts';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  const { isDark } = useContext(ThemeContext);
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <div className="text-center space-y-8 mb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <Logo size="xl" variant="teacher" />
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-widest border transition-colors",
            isDark 
              ? "bg-gold/10 text-gold border-gold/20" 
              : "bg-royal-red/10 text-royal-red border-royal-red/20"
          )}>
            <Sparkles size={16} />
            <span>The future of education is here</span>
          </div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "text-7xl md:text-9xl font-black tracking-tighter leading-none italic uppercase transition-colors",
            isDark ? "text-gold" : "text-royal-red"
          )}
        >
          ELEVATE YOUR <br /> CLASSROOM.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "text-xl opacity-80 max-w-2xl mx-auto font-medium transition-colors",
            isDark ? "text-gold" : "text-royal-red/80"
          )}
        >
          Eclipse Teacher is your AI-powered assistant. Automate grading, 
          track student progress, and generate lesson ideas with unprecedented ease.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Link 
            to="/teacher/auth"
            className={cn(
              "px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-xl",
              isDark ? "bg-gold text-royal-red shadow-gold/10" : "bg-royal-red text-white shadow-royal-red/20"
            )}
          >
            Enter Teacher Portal
          </Link>
          <Link 
            to="/"
            className={cn(
              "px-8 py-4 border rounded-2xl font-bold text-lg transition-all",
              isDark 
                ? "bg-gold/10 text-gold border-gold/20 hover:bg-gold/20" 
                : "bg-white text-royal-red border-royal-red/20 hover:bg-royal-red/5"
            )}
          >
            Switch to Student
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-20">
        <FeatureCard 
          icon={<BarChart2 className={isDark ? "text-gold" : "text-royal-red"} />}
          title="Class Insights"
          description="Instant analytics on student performance. Identify gaps and celebrate growth in real-time."
          isDark={isDark}
        />
        <FeatureCard 
          icon={<Lightbulb className={isDark ? "text-gold" : "text-royal-red"} />}
          title="AI Lesson Ideas"
          description="Generate creative, curriculum-aligned activities and assignments in seconds."
          isDark={isDark}
        />
        <FeatureCard 
          icon={<Users className={isDark ? "text-gold" : "text-royal-red"} />}
          title="Group Management"
          description="Organize your classes into digital groups for focused tracking and collaborative projects."
          isDark={isDark}
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, isDark }: { icon: React.ReactNode, title: string, description: string, isDark: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className={cn(
        "p-8 border rounded-3xl space-y-4 transition-all",
        isDark 
          ? "bg-gold/5 border-gold/10 hover:bg-gold/10" 
          : "bg-white border-royal-red/10 shadow-sm hover:shadow-md"
      )}
    >
      <div className={cn(
        "p-4 rounded-2xl w-fit shadow-inner transition-colors",
        isDark ? "bg-gold/10" : "bg-royal-red/5"
      )}>
        {icon}
      </div>
      <h3 className={cn(
        "text-2xl font-bold uppercase italic tracking-tighter transition-colors",
        isDark ? "text-gold" : "text-royal-red"
      )}>{title}</h3>
      <p className={cn(
        "opacity-70 leading-relaxed font-medium transition-colors",
        isDark ? "text-gold" : "text-royal-red/70"
      )}>{description}</p>
    </motion.div>
  );
}
