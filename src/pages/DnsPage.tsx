import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, Save, Trash2, Plus, ArrowLeft, CheckCircle, 
  AlertCircle, ChevronDown, List, Mail, Server, Info
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

interface DnsRecord {
  id: string;
  hostName: string;
  type: 'A' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'AAAA';
  result: string;
  priority?: number;
  weight?: number;
  port?: number;
}

export default function DnsPage() {
  const location = useLocation();
  const isTeacher = location.pathname.startsWith('/teacher');
  const [domain, setDomain] = useState('eclipseapp.co.uk');
  const [template, setTemplate] = useState('Please select...');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Styles for Teacher Portal adaptation
  const styles = {
    card: isTeacher ? "bg-gold/10 border-gold/20" : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10",
    text: isTeacher ? "text-gold" : "text-black dark:text-white",
    subtext: isTeacher ? "text-gold opacity-50" : "opacity-50",
    input: isTeacher ? "bg-royal-red/30 border-gold/20 text-gold" : "bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10",
    buttonPrimary: isTeacher ? "bg-gold text-royal-red" : "bg-black text-white dark:bg-white dark:text-black",
    buttonSecondary: isTeacher ? "bg-gold/10 border-gold/20 text-gold" : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
  };

  const [records, setRecords] = useState<DnsRecord[]>([
    { id: '1', hostName: '.domain', type: 'A', result: '199.36.158.100' },
    { id: '2', hostName: 'autoconfig.domain', type: 'CNAME', result: 'autoconfig.hosts.co.uk' },
    { id: '3', hostName: 'imap.domain', type: 'CNAME', result: 'imap.hosts.co.uk' },
    { id: '4', hostName: 'pop3.domain', type: 'CNAME', result: 'pop3.hosts.co.uk' },
    { id: '5', hostName: 'www.domain', type: 'CNAME', result: 'fwd3.hosts.co.uk' },
    { id: '6', hostName: '.domain', type: 'TXT', result: 'google-site-verification=4mco107ZZTwFb8JfUHWEbsg7GdXHiq_sB041H-2hyjQ' },
    { id: '7', hostName: '.domain', type: 'TXT', result: 'hosting-site=gen-lang-client-0438904042' },
    { id: '8', hostName: '.domain', type: 'TXT', result: 'v=spf1 include:spf.hosts.co.uk ~all' },
  ]);

  const [mxRecords, setMxRecords] = useState<DnsRecord[]>([
    { id: 'mx1', hostName: '.domain', priority: 30, result: 'athena.hosts.co.uk', type: 'MX' },
    { id: 'mx2', hostName: '.domain', priority: 30, result: 'hermes.hosts.co.uk', type: 'MX' },
  ]);

  const [srvRecords, setSrvRecords] = useState<DnsRecord[]>([
    { id: 'srv1', hostName: '_autodiscover._tcp', priority: 0, weight: 0, port: 443, result: 'autodiscover.hosts.co.uk', type: 'SRV' },
  ]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  const addRecord = (type: 'standard' | 'mx' | 'srv') => {
    const id = Math.random().toString(36).substring(7);
    if (type === 'standard') {
      setRecords([...records, { id, hostName: '.domain', type: 'A', result: '' }]);
    } else if (type === 'mx') {
      setMxRecords([...mxRecords, { id, hostName: '.domain', priority: 10, result: '', type: 'MX' }]);
    } else {
      setSrvRecords([...srvRecords, { id, hostName: '', priority: 0, weight: 0, port: 80, result: '', type: 'SRV' }]);
    }
  };

  const deleteRecord = (id: string, type: 'standard' | 'mx' | 'srv') => {
    if (type === 'standard') setRecords(records.filter(r => r.id !== id));
    else if (type === 'mx') setMxRecords(mxRecords.filter(r => r.id !== id));
    else setSrvRecords(srvRecords.filter(r => r.id !== id));
  };

  return (
    <div className={cn("max-w-6xl mx-auto px-4 py-12 space-y-12 pb-32", styles.text)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <Link to={isTeacher ? "/teacher/admin" : "/admin"} className={cn("p-2 rounded-full transition-colors", styles.subtext, "hover:opacity-100")}>
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">DNS <span className="opacity-50">Management</span></h1>
          </div>
          <div className={cn("flex items-center gap-2 p-3 rounded-2xl text-xs font-bold uppercase tracking-widest border", isTeacher ? "bg-gold/10 border-gold/20 text-gold" : "bg-blue-500/10 border-blue-500/20 text-blue-500")}>
            <Info size={14} />
            <span>Changes may take 24-48 hours to propagate globally.</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className={cn("px-6 py-3 font-bold transition-opacity", styles.subtext, "hover:opacity-100")}>Cancel</button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={cn("px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:scale-105 transition-all active:scale-95 disabled:opacity-50", styles.buttonPrimary)}
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : showSuccess ? (
              <CheckCircle size={20} />
            ) : (
              <Save size={20} />
            )}
            {isSaving ? 'Propagating...' : showSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={cn("p-8 rounded-[2.5rem] border space-y-6", styles.card)}>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 ml-1">Domain names</h3>
            <div className="relative">
              <Globe className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={20} />
              <input 
                type="text" 
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={cn("w-full pl-14 pr-6 py-4 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all font-bold", styles.input)}
              />
            </div>
          </div>
        </div>

        <div className={cn("p-8 rounded-[2.5rem] border space-y-6", styles.card)}>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 ml-1">Templates</h3>
            <div className="relative">
              <List className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={20} />
              <select 
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className={cn("w-full pl-14 pr-6 py-4 border rounded-2xl focus:outline-none appearance-none font-bold", styles.input)}
              >
                <option>Please select...</option>
                <option>Google Workspace</option>
                <option>Microsoft 365</option>
                <option>iCloud Mail</option>
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 opacity-30" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Record Table */}
      <div className={cn("p-8 rounded-[3rem] border space-y-8", styles.card)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/10 dark:bg-white/10 rounded-xl flex items-center justify-center">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">A, CNAME records etc</h2>
              <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Base infrastructure records</p>
            </div>
          </div>
          <button 
            onClick={() => addRecord('standard')}
            className={cn("flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all", styles.buttonSecondary)}
          >
            <Plus size={14} /> Add records
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest opacity-30 border-b border-current">
                <th className="pb-4 pl-4 w-12 text-current font-bold bg-transparent">#</th>
                <th className="pb-4 text-current font-bold bg-transparent">Host name</th>
                <th className="pb-4 text-center w-24 text-current font-bold bg-transparent">Type</th>
                <th className="pb-4 text-current font-bold bg-transparent">Result</th>
                <th className="pb-4 pr-4 w-12 bg-transparent text-current font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-current/5">
              {records.map((record, index) => (
                <tr key={record.id} className="group">
                  <td className="py-4 pl-4 font-mono text-[10px] opacity-30">{index + 1}</td>
                  <td className="py-2">
                    <input 
                      className="bg-transparent font-medium text-sm focus:outline-none w-full" 
                      defaultValue={record.hostName} 
                    />
                  </td>
                  <td className="py-2 text-center">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded-full">{record.type}</span>
                  </td>
                  <td className="py-2">
                    <input 
                      className="bg-transparent font-mono text-sm focus:outline-none w-full opacity-60" 
                      defaultValue={record.result} 
                    />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <button 
                      onClick={() => deleteRecord(record.id, 'standard')}
                      className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MX Records */}
      <div className={cn("p-8 rounded-[3rem] border space-y-8", styles.card)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/10 dark:bg-white/10 rounded-xl flex items-center justify-center">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Mail exchange records</h2>
              <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Email routing management</p>
            </div>
          </div>
          <button 
            onClick={() => addRecord('mx')}
            className={cn("flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all", styles.buttonSecondary)}
          >
            <Plus size={14} /> Add MX records
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest opacity-30 border-b border-current">
                <th className="pb-4 pl-4 w-12 text-current font-bold bg-transparent">#</th>
                <th className="pb-4 text-current font-bold bg-transparent">Host name</th>
                <th className="pb-4 w-24 text-current font-bold bg-transparent">Priority</th>
                <th className="pb-4 text-current font-bold bg-transparent">Result</th>
                <th className="pb-4 pr-4 w-12 bg-transparent text-current font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-current/5">
              {mxRecords.map((record, index) => (
                <tr key={record.id} className="group">
                  <td className="py-4 pl-4 font-mono text-[10px] opacity-30">{index + 1}</td>
                  <td className="py-2">
                    <input className="bg-transparent font-medium text-sm focus:outline-none w-full" defaultValue={record.hostName} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-16" defaultValue={record.priority} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-full opacity-60" defaultValue={record.result} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <button 
                      onClick={() => deleteRecord(record.id, 'mx')}
                      className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SRV Records */}
      <div className={cn("p-8 rounded-[3rem] border space-y-8", styles.card)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/10 dark:bg-white/10 rounded-xl flex items-center justify-center">
              <FileCode size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-tight">Service records</h2>
              <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Protocol-specific discoveries</p>
            </div>
          </div>
          <button 
            onClick={() => addRecord('srv')}
            className={cn("flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all", styles.buttonSecondary)}
          >
            <Plus size={14} /> Add SRV records
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest opacity-30 border-b border-current">
                <th className="pb-4 pl-4 w-12 text-current font-bold bg-transparent">#</th>
                <th className="pb-4 text-current font-bold bg-transparent">Name</th>
                <th className="pb-4 w-20 text-current font-bold bg-transparent">Priority</th>
                <th className="pb-4 w-20 text-current font-bold bg-transparent">Weight</th>
                <th className="pb-4 w-20 text-current font-bold bg-transparent">Port</th>
                <th className="pb-4 text-current font-bold bg-transparent">Result</th>
                <th className="pb-4 pr-4 w-12 bg-transparent text-current font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-current/5">
              {srvRecords.map((record, index) => (
                <tr key={record.id} className="group">
                  <td className="py-4 pl-4 font-mono text-[10px] opacity-30">{index + 1}</td>
                  <td className="py-2">
                    <input className="bg-transparent font-medium text-sm focus:outline-none w-full" defaultValue={record.hostName} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-12" defaultValue={record.priority} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-12" defaultValue={record.weight} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-12" defaultValue={record.port} />
                  </td>
                  <td className="py-2">
                    <input className="bg-transparent font-mono text-sm focus:outline-none w-full opacity-60" defaultValue={record.result} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <button 
                      onClick={() => deleteRecord(record.id, 'srv')}
                      className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 pt-8">
        <button className="px-12 py-4 bg-red-500 text-white rounded-2xl font-bold shadow-xl shadow-red-500/20 hover:scale-105 transition-all active:scale-95">Delete Zones</button>
      </div>
    </div>
  );
}

function FileCode({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  );
}
