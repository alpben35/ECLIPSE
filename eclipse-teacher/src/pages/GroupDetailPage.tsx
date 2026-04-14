import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, MessageSquare, BarChart2, CheckSquare, 
  Send, Plus, Trash2, ChevronLeft, MoreVertical, 
  UserPlus, LogOut, Shield, Clock, Hash, Loader2,
  Share2, FileText, Calendar, Image as ImageIcon, Mic, StopCircle, AtSign, Play, Pause
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../../../src/lib/firebase';
import { 
  doc, onSnapshot, collection, query, orderBy, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, 
  arrayRemove, getDoc, limit 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthContext } from '../../../src/App';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'chat' | 'progress' | 'assignments' | 'members';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useContext(AuthContext);
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [newMessage, setNewMessage] = useState('');
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '' });
  
  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  // Tagging states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!group?.members) return;
    
    const fetchMemberProfiles = async () => {
      const profiles = await Promise.all(
        group.members.map(async (uid: string) => {
          const snap = await getDoc(doc(db, 'public_profiles', uid));
          return snap.exists() ? { uid, ...snap.data() } : null;
        })
      );
      setMemberProfiles(profiles.filter(p => p !== null));
    };
    
    fetchMemberProfiles();
  }, [group?.members]);

  useEffect(() => {
    if (!groupId || !user) return;

    const groupRef = doc(db, 'groups', groupId);
    const unsubGroup = onSnapshot(groupRef, (doc) => {
      if (!doc.exists()) {
        navigate('/teacher/groups');
        return;
      }
      const data = doc.data();
      if (!data.members.includes(user.uid)) {
        navigate('/teacher/groups');
        return;
      }
      setGroup({ id: doc.id, ...data });
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `groups/${groupId}`));

    const messagesQ = query(collection(db, 'groups', groupId, 'messages'), orderBy('timestamp', 'asc'), limit(100));
    const unsubMessages = onSnapshot(messagesQ, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const assignmentsQ = query(collection(db, 'groups', groupId, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubAssignments = onSnapshot(assignmentsQ, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubGroup();
      unsubMessages();
      unsubAssignments();
    };
  }, [groupId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user || !groupId) return;

    try {
      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        senderId: user.uid,
        senderName: profile?.displayName || 'Anonymous',
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      });
      setNewMessage('');
      setShowMentions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/messages`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId || !user) return;

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `groups/${groupId}/images/${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        senderId: user.uid,
        senderName: profile?.displayName || 'Anonymous',
        content: 'Sent a photo',
        imageUrl: url,
        timestamp: new Date().toISOString(),
        type: 'image'
      });
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await uploadVoiceNote(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const uploadVoiceNote = async (blob: Blob) => {
    if (!groupId || !user) return;
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_voicenote.webm`;
      const storageRef = ref(storage, `groups/${groupId}/audio/${fileName}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        senderId: user.uid,
        senderName: profile?.displayName || 'Anonymous',
        content: 'Sent a voice note',
        audioUrl: url,
        timestamp: new Date().toISOString(),
        type: 'audio'
      });
    } catch (error) {
      console.error("Voice upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    const words = value.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionSearch(lastWord.slice(1));
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const words = newMessage.split(' ');
    words[words.length - 1] = `@${name} `;
    setNewMessage(words.join(' '));
    setShowMentions(false);
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return;

    try {
      await addDoc(collection(db, 'groups', groupId, 'assignments'), {
        ...newAssignment,
        sharedBy: user.uid,
        sharedByName: profile?.displayName || 'Anonymous',
        createdAt: new Date().toISOString()
      });
      setIsAddingAssignment(false);
      setNewAssignment({ title: '', description: '', dueDate: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/assignments`);
    }
  };

  const leaveGroup = async () => {
    if (!groupId || !user || !window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayRemove(user.uid)
      });
      navigate('/teacher/groups');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin opacity-20 text-gold" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/teacher/groups')}
            className="p-3 bg-gold/5 rounded-2xl hover:bg-gold/10 transition-colors text-gold"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-gold">{group.name}</h1>
              <span className="px-3 py-1 bg-gold/5 rounded-full text-[10px] font-bold uppercase tracking-widest opacity-50 text-gold">
                {group.subject}
              </span>
            </div>
            <p className="opacity-50 text-sm mt-1 text-gold">{group.members.length} Members • {group.gradeLevel}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={leaveGroup}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-500/20 transition-all"
          >
            <LogOut size={18} />
            Leave
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-gold/5 rounded-2xl border border-gold/10 w-fit">
        {[
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'progress', icon: BarChart2, label: 'Progress' },
          { id: 'assignments', icon: CheckSquare, label: 'Assignments' },
          { id: 'members', icon: Users, label: 'Members' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeTab === tab.id ? "bg-gold text-royal-red shadow-lg" : "text-gold opacity-50 hover:opacity-100"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-gold/5 rounded-[3rem] border border-gold/5 overflow-hidden min-h-[60vh] flex flex-col">
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-[60vh]">
            <div 
              ref={scrollRef}
              className="flex-1 p-8 overflow-y-auto space-y-6 scroll-smooth"
            >
              {messages.map((msg, i) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-2 mb-1 px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-gold">{msg.senderName}</span>
                      <span className="text-[8px] opacity-50 text-gold">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                    </div>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-3xl text-sm leading-relaxed shadow-lg",
                      isMe ? "bg-gold text-royal-red rounded-tr-none" : "bg-gold/10 text-gold rounded-tl-none border border-gold/10"
                    )}>
                      {msg.type === 'image' ? (
                        <div className="space-y-2">
                          <img 
                            src={msg.imageUrl} 
                            alt="Shared" 
                            className="rounded-2xl max-w-full max-h-[300px] object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {msg.content && <p className="text-xs opacity-80">{msg.content}</p>}
                        </div>
                      ) : msg.type === 'audio' ? (
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className={cn("p-2 rounded-full", isMe ? "bg-royal-red/20" : "bg-gold/10")}>
                            <Mic size={16} />
                          </div>
                          <audio src={msg.audioUrl} controls className="h-8 w-full max-w-[150px] filter invert" />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {msg.content.split(/(@\w+)/g).map((part: string, idx: number) => 
                            part.startsWith('@') ? (
                              <span key={idx} className="font-bold text-orange-400">{part}</span>
                            ) : part
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 text-center space-y-4 text-gold">
                  <MessageSquare size={48} />
                  <p className="font-bold">No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>
            
            <div className="relative">
              <AnimatePresence>
                {showMentions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-6 mb-2 w-64 bg-royal-red rounded-2xl shadow-2xl border border-gold/20 overflow-hidden z-50"
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {memberProfiles
                        .filter(p => p.displayName?.toLowerCase().includes(mentionSearch.toLowerCase()))
                        .map(p => (
                          <button 
                            key={p.uid}
                            onClick={() => insertMention(p.displayName || 'User')}
                            className="w-full flex items-center gap-3 p-2 hover:bg-gold/10 rounded-xl transition-colors text-gold"
                          >
                            <img 
                              src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} 
                              className="w-6 h-6 rounded-full"
                              alt="Avatar"
                            />
                            <span className="text-sm font-bold">{p.displayName}</span>
                          </button>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSendMessage} className="p-6 bg-gold/5 border-t border-gold/10 flex items-center gap-3">
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-gold/10 rounded-xl hover:bg-gold/20 transition-all text-gold/60"
                >
                  <ImageIcon size={20} />
                </button>

                <button 
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    isRecording ? "bg-red-500 text-white animate-pulse" : "bg-gold/10 text-gold/60 hover:bg-gold/20"
                  )}
                >
                  {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                </button>

                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder={isRecording ? `Recording... ${recordingTime}s` : "Type a message..."}
                    disabled={isRecording}
                    className="w-full bg-royal-red p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all font-medium pr-12 text-gold placeholder:text-gold/30 border border-gold/10"
                  />
                  {isUploading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="animate-spin opacity-40 text-gold" size={16} />
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={!newMessage.trim() || isRecording || isUploading}
                  className="p-4 bg-gold text-royal-red rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-gold/5 rounded-3xl flex items-center justify-center mx-auto opacity-30 text-gold">
              <BarChart2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gold">Group Progress</h3>
              <p className="opacity-50 max-w-md mx-auto text-gold">Share your latest test scores and celebrate milestones together.</p>
            </div>
            <button 
              onClick={() => navigate('/teacher/progress')}
              className="px-8 py-4 bg-gold text-royal-red rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Go to Class Progress
            </button>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gold">Shared Assignments</h3>
              <button 
                onClick={() => setIsAddingAssignment(true)}
                className="flex items-center gap-2 px-6 py-2 bg-gold text-royal-red rounded-xl text-sm font-bold hover:scale-105 transition-transform"
              >
                <Plus size={16} />
                Add Assignment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignments.map(assignment => (
                <div key={assignment.id} className="p-8 bg-royal-red rounded-[2rem] border border-gold/5 space-y-4 relative group">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-gold/5 rounded-xl text-gold">
                      <FileText size={20} />
                    </div>
                    {assignment.sharedBy === user?.uid && (
                      <button 
                        onClick={() => deleteDoc(doc(db, 'groups', groupId!, 'assignments', assignment.id))}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all text-gold"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gold">{assignment.title}</h4>
                    <p className="text-sm opacity-50 mt-1 text-gold">{assignment.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gold/5">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 text-gold">
                      <Calendar size={12} />
                      Due: {assignment.dueDate ? format(new Date(assignment.dueDate), 'MMM d, yyyy') : 'No date'}
                    </div>
                    <span className="text-[10px] font-bold opacity-40 text-gold">By {assignment.sharedByName}</span>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-20 text-gold">
                  <p className="font-bold">No assignments shared yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-8 space-y-6">
            <h3 className="text-2xl font-bold mb-8 text-gold">Group Members ({group.members.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.members.map((memberId: string) => (
                <MemberCard key={memberId} userId={memberId} isCreator={memberId === group.createdBy} />
              ))}
            </div>
            {group.isPrivate && group.createdBy === user?.uid && (
              <div className="mt-12 p-8 bg-gold/5 rounded-3xl border border-dashed border-gold/10 text-center">
                <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2 text-gold">Invite Code</p>
                <p className="text-4xl font-black tracking-[0.5em] text-gold">{group.inviteCode}</p>
                <p className="text-xs opacity-30 mt-4 text-gold">Share this code with students you want to invite.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Assignment Modal */}
      <AnimatePresence>
        {isAddingAssignment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingAssignment(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-royal-red rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gold/20"
            >
              <h3 className="text-2xl font-bold mb-8 text-gold">Share Assignment</h3>
              <form onSubmit={handleAddAssignment} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Title</label>
                  <input 
                    type="text"
                    required
                    value={newAssignment.title}
                    onChange={e => setNewAssignment({...newAssignment, title: e.target.value})}
                    placeholder="e.g. Chapter 5 Practice Problems"
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold placeholder:text-gold/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Description</label>
                  <textarea 
                    value={newAssignment.description}
                    onChange={e => setNewAssignment({...newAssignment, description: e.target.value})}
                    placeholder="Details about the task..."
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none min-h-[100px] resize-none text-gold placeholder:text-gold/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2 text-gold">Due Date</label>
                  <input 
                    type="date"
                    required
                    value={newAssignment.dueDate}
                    onChange={e => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                    className="w-full p-4 bg-gold/5 rounded-2xl focus:outline-none font-bold text-gold"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-gold text-royal-red rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
                >
                  Post Assignment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberCard({ userId, isCreator }: { userId: string, isCreator: boolean }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile(snap.data());
    });
  }, [userId]);

  if (!profile) return <div className="p-4 bg-gold/5 rounded-2xl animate-pulse h-16" />;

  return (
    <div className="flex items-center gap-4 p-4 bg-royal-red rounded-2xl border border-gold/5">
      <img 
        src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
        alt="Avatar" 
        className="w-10 h-10 rounded-full bg-gold/5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate text-gold">{profile.displayName || 'Anonymous'}</p>
          {isCreator && <Shield size={12} className="text-gold" />}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-gold">Level {profile.level || 1} • {profile.rank || 'Welcome'}</p>
      </div>
    </div>
  );
}
