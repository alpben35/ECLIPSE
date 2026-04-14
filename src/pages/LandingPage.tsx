import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Brain, TrendingUp, Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {

  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <div className="text-center space-y-8 mb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 text-sm font-medium"
        >
          <Sparkles size={16} />
          <span>The future of learning is here</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-7xl md:text-9xl font-black tracking-tighter leading-none"
        >
          MASTER EVERY <br /> SUBJECT.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl opacity-50 max-w-2xl mx-auto"
        >
          Eclipse is your personal AI tutor. From Year 1 to University, 
          we help you teach, solve, and track your progress like never before.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Link 
            to="/auth"
            className="px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-lg hover:scale-105 transition-transform"
          >
            Start Learning Now
          </Link>
          <a 
            href="/teacher"
            className="px-8 py-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl font-bold text-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          >
            Teacher Portal
          </a>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <FeatureCard 
          icon={<Brain className="text-blue-500" />}
          title="Dual AI Modes"
          description="Choose between 'Teach' for deep conceptual understanding or 'Solve' for quick answers."
        />
        <FeatureCard 
          icon={<TrendingUp className="text-green-500" />}
          title="Progress Tracking"
          description="Visualize your growth with subject-specific graphs and test score history."
        />
        <FeatureCard 
          icon={<Shield className="text-purple-500" />}
          title="Secure & Private"
          description="Your data is protected with industry-standard security. Your progress is yours alone."
        />
      </div>

      <div className="mt-32 p-12 bg-black/5 dark:bg-white/5 rounded-[3rem] text-center space-y-8">
        <Zap size={48} className="mx-auto" />
        <h2 className="text-4xl font-bold">Ready to eclipse the competition?</h2>
        <p className="opacity-50 max-w-xl mx-auto">Join thousands of students using AI to supercharge their education.</p>
        <Link 
          to="/auth"
          className="px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold inline-block"
        >
          Create Your Account
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="p-8 bg-black/5 dark:bg-white/5 rounded-3xl space-y-4"
    >
      <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl w-fit shadow-sm">
        {icon}
      </div>
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="opacity-50 leading-relaxed">{description}</p>
    </motion.div>
  );
}
