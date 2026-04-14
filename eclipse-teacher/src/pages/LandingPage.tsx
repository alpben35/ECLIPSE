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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 text-gold text-sm font-medium border border-gold/20"
        >
          <Sparkles size={16} />
          <span>The future of teaching is here</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-7xl md:text-9xl font-black tracking-tighter leading-none text-gold"
        >
          EMPOWER EVERY <br /> STUDENT.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl opacity-50 max-w-2xl mx-auto text-gold"
        >
          Eclipse Teacher is your personal AI assistant for education. 
          Manage lessons, track student progress, and refine your teaching strategy.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Link 
            to="/teacher/auth"
            className="px-8 py-4 bg-gold text-royal-red rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl"
          >
            Start Teaching Now
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <FeatureCard 
          icon={<Brain className="text-gold" />}
          title="AI Lesson Planning"
          description="Generate comprehensive lesson plans and teaching materials in seconds."
        />
        <FeatureCard 
          icon={<TrendingUp className="text-gold" />}
          title="Student Analytics"
          description="Visualize class growth with detailed performance metrics and history."
        />
        <FeatureCard 
          icon={<Shield className="text-gold" />}
          title="Secure & Private"
          description="Your educational data is protected with industry-standard security."
        />
      </div>

      <div className="mt-32 p-12 bg-gold/10 border border-gold/20 rounded-[3rem] text-center space-y-8">
        <Zap size={48} className="mx-auto text-gold" />
        <h2 className="text-4xl font-bold text-gold">Ready to transform your classroom?</h2>
        <p className="opacity-50 max-w-xl mx-auto text-gold">Join thousands of educators using AI to supercharge their teaching.</p>
        <Link 
          to="/teacher/auth"
          className="px-8 py-4 bg-gold text-royal-red rounded-2xl font-bold shadow-xl inline-block"
        >
          Create Teacher Account
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="p-8 bg-gold/10 border border-gold/20 rounded-3xl space-y-4"
    >
      <div className="p-4 bg-gold/10 rounded-2xl w-fit shadow-sm">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-gold">{title}</h3>
      <p className="opacity-50 leading-relaxed text-gold">{description}</p>
    </motion.div>
  );
}
