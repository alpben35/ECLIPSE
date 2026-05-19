import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Eye, FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="space-y-4">
        <h1 className="text-5xl font-black tracking-tighter italic uppercase">Privacy Policy</h1>
        <p className="opacity-60 text-lg">Last updated: April 15, 2026</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[2.5rem] border border-black/10 dark:border-white/10 space-y-4">
          <Shield className="text-blue-500" size={32} />
          <h3 className="text-xl font-bold">Data Protection</h3>
          <p className="text-sm opacity-60 leading-relaxed">
            We use industry-standard encryption to protect your data. Your personal information and chat history are stored securely in Google Firebase.
          </p>
        </div>
        <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[2.5rem] border border-black/10 dark:border-white/10 space-y-4">
          <Eye className="text-green-500" size={32} />
          <h3 className="text-xl font-bold">Data Usage</h3>
          <p className="text-sm opacity-60 leading-relaxed">
            We only use your data to provide AI tutoring services. We do not sell your personal information to third parties.
          </p>
        </div>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lock size={20} />
            1. Information We Collect
          </h2>
          <p className="opacity-70">
            We collect information you provide directly to us, such as when you create an account, use the AI tutor, or communicate with us. This includes:
          </p>
          <ul className="list-disc pl-6 opacity-70 space-y-2">
            <li>Name and email address</li>
            <li>Profile information and rank</li>
            <li>Chat history with the AI tutor</li>
            <li>Academic progress and test scores</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={20} />
            2. How We Use Information
          </h2>
          <p className="opacity-70">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 opacity-70 space-y-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Personalize your learning experience</li>
            <li>Monitor and analyze trends and usage</li>
            <li>Communicate with you about products and services</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={20} />
            3. Data Security
          </h2>
          <p className="opacity-70">
            We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. We use industry-standard encryption and secure cloud infrastructure provided by Google Cloud and Firebase.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">4. Your Rights (GDPR & CCPA)</h2>
          <p className="opacity-70">
            Depending on your location, you may have the right to:
          </p>
          <ul className="list-disc pl-6 opacity-70 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Request data portability</li>
          </ul>
          <p className="opacity-70">
            To exercise any of these rights, please contact our Data Protection Officer using the details below.
          </p>
        </section>

        <section className="space-y-6 p-8 bg-black/5 dark:bg-white/5 rounded-[2.5rem] border border-black/10 dark:border-white/10">
          <h2 className="text-2xl font-bold">5. Contact Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Company Name</p>
              <p className="font-bold">Eclipse AI Learning Systems</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Privacy Inquiries</p>
              <p className="font-bold">privacy@eclipseapp.co.uk</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Data Protection Officer</p>
              <p className="font-bold">DPO Representative</p>
              <p className="text-sm opacity-60">dpo@eclipseapp.co.uk</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Global Support Node</p>
              <p className="font-bold">Distributed Network</p>
              <p className="text-xs opacity-40">(Address available upon verified request for legal compliance)</p>
            </div>
          </div>
          <p className="text-xs opacity-50 pt-4 border-t border-black/10 dark:border-white/10">
            We are committed to responding to all valid privacy inquiries within 30 days.
          </p>
        </section>
      </div>
    </div>
  );
}
