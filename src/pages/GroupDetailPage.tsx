import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, MessageSquare, BarChart2, CheckSquare, 
  Send, Plus, Trash2, ChevronLeft, MoreVertical, 
  UserPlus, LogOut, Shield, Clock, Hash, Loader2, Camera,
  Share2, FileText, Calendar, Image as ImageIcon, Mic, StopCircle, AtSign, Play, Pause,
  ArrowLeft, Info, ChevronRight, Lock, Globe, Check, X, User as UserIcon, Settings, UserMinus
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage, encryptData, decryptData } from '../lib/firebase';
import { 
  doc, onSnapshot, collection, query, orderBy, 
  addDoc, serverTimestamp, deleteDoc, updateDoc, 
  arrayRemove, getDoc, limit, where, getDocs, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthContext } from '../lib/contexts';
import { SUBJECTS, GRADE_LEVELS, OWNER_EMAIL } from '../lib/constants';
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
  const { user, profile, isOwner, isAdmin } = useContext(AuthContext);
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [newMessage, setNewMessage] = useState('');
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '', subject: '', gradeLevel: '', isPrivate: false });
  
  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [isProctoring, setIsProctoring] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isProctoring) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Camera error:", err);
          setIsProctoring(false);
        });
    } else {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isProctoring]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  // Tagging states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  
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
    if (!user) return;

    // Listen to friendships
    const friendshipsQ = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', user.uid)
    );
    const unsubFriends = onSnapshot(friendshipsQ, async (snapshot) => {
      const friendIds = snapshot.docs.map(doc => {
        const data = doc.data();
        return data.users.find((id: string) => id !== user.uid);
      });
      
      const friendProfiles = await Promise.all(
        friendIds.map(async (id) => {
          const snap = await getDocs(query(collection(db, 'public_profiles'), where('uid', '==', id)));
          return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
        })
      );
      setFriends(friendProfiles.filter(p => p !== null));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'friendships'));

    return () => unsubFriends();
  }, [user]);

  useEffect(() => {
    if (!groupId || !user) return;

    let unsubGroup: (() => void) | undefined;
    const groupRef = doc(db, 'groups', groupId);
    const isAdminPlus = profile?.email === OWNER_EMAIL || 
                        profile?.rank === 'Owner' || 
                        profile?.rank === 'Temporary Owner' || 
                        profile?.rank === 'Admin';

    if (groupId === 'admin_council') {
      if (!isAdmin) {
        navigate('/groups');
        return;
      }
      setGroup({
        id: 'admin_council',
        name: 'Admin Council',
        description: 'Private group for Admins and Owners to discuss system vision.',
        subject: 'System',
        gradeLevel: 'All',
        isPrivate: true,
        members: [user.uid], // Simplified for UI
        createdBy: 'system'
      });
      setLoading(false);
    } else {
      unsubGroup = onSnapshot(groupRef, (doc) => {
        if (!doc.exists()) {
          navigate('/groups');
          return;
        }
        const data = doc.data();
        if (!data.members.includes(user.uid) && !isAdmin) {
          navigate('/groups');
          return;
        }
        setGroup({ id: doc.id, ...data });
        setEditData({
          name: data.name,
          description: data.description,
          subject: data.subject,
          gradeLevel: data.gradeLevel,
          isPrivate: data.isPrivate
        });
        setLoading(false);
      }, (err) => handleFirestoreError(err, OperationType.GET, `groups/${groupId}`));
    }

    const messagesQ = query(collection(db, 'groups', groupId, 'messages'), orderBy('timestamp', 'desc'), limit(100));
    const unsubMessages = onSnapshot(messagesQ, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = data.timestamp;
        
        if (timestamp && typeof timestamp.toDate === 'function') {
          timestamp = timestamp.toDate().toISOString();
        } else if (!timestamp) {
          timestamp = new Date().toISOString();
        }

        return {
          id: doc.id,
          ...data,
          timestamp,
          content: data.type === 'text' ? decryptData(data.content) : data.content
        };
      });
      setMessages(loadedMessages.reverse());
    }, (err) => handleFirestoreError(err, OperationType.GET, `groups/${groupId}/messages`));

    const assignmentsQ = query(collection(db, 'groups', groupId, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubAssignments = onSnapshot(assignmentsQ, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          title: decryptData(data.title),
          description: decryptData(data.description)
        };
      }));
    }, (err) => handleFirestoreError(err, OperationType.GET, `groups/${groupId}/assignments`));

    return () => {
      if (unsubGroup) unsubGroup();
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
        content: encryptData(newMessage.trim()),
        timestamp: serverTimestamp(),
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
        timestamp: serverTimestamp(),
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

    const lastChar = value[value.length - 1];
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

  const inviteToGroup = async (friendUid: string) => {
    if (!group || !user) return;
    setInviting(friendUid);
    try {
      await updateDoc(doc(db, 'groups', groupId!), {
        members: arrayUnion(friendUid)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    } finally {
      setInviting(null);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return;

    try {
      await addDoc(collection(db, 'groups', groupId, 'assignments'), {
        title: encryptData(newAssignment.title),
        description: encryptData(newAssignment.description),
        dueDate: newAssignment.dueDate,
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
      navigate('/groups');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), editData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const kickMember = async (memberUid: string) => {
    if (!groupId || !window.confirm("Are you sure you want to kick this member?")) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayRemove(memberUid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin opacity-20" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/groups')}
            className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">{group.name}</h1>
              <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                {group.subject}
              </span>
            </div>
            <p className="text-black/50 dark:text-white/50 text-sm mt-1">{group.members.length} Members • {group.gradeLevel}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-6 py-3 bg-black/5 dark:bg-white/5 rounded-2xl font-bold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            >
              <Settings size={18} />
              Edit
            </button>
          )}
          <button 
            onClick={() => setIsProctoring(!isProctoring)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all",
              isProctoring ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            <Camera size={18} />
            {isProctoring ? 'Stop Camera' : 'Test Camera'}
          </button>
          <button 
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold text-sm hover:scale-105 transition-transform shadow-lg"
          >
            <UserPlus size={18} />
            Invite
          </button>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 w-fit">
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
                activeTab === tab.id ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "opacity-50 hover:opacity-100"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {isProctoring && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-48 h-32 bg-black rounded-2xl overflow-hidden border-2 border-red-500 shadow-2xl shadow-red-500/20"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover mirror"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] font-bold text-white uppercase tracking-widest">Live Monitoring</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Area */}
      <div className="bg-black/5 dark:bg-white/5 rounded-[3rem] border border-black/5 dark:border-white/5 overflow-hidden min-h-[60vh] flex flex-col">
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
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 dark:opacity-60">{msg.senderName}</span>
                      <span className="text-[8px] opacity-60 dark:opacity-40">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                    </div>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-3xl text-sm leading-relaxed",
                      isMe ? "bg-black text-white dark:bg-white dark:text-black rounded-tr-none shadow-md" : "bg-black/5 dark:bg-white/5 rounded-tl-none"
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
                          <div className={cn("p-2 rounded-full", isMe ? "bg-white/20" : "bg-black/10 dark:bg-white/10")}>
                            <Mic size={16} />
                          </div>
                          <audio src={msg.audioUrl} controls className="h-8 w-full max-w-[150px]" />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {msg.content.split(/(@\w+)/g).map((part: string, idx: number) => 
                            part.startsWith('@') ? (
                              <span key={idx} className="font-bold text-orange-500 dark:text-orange-400">{part}</span>
                            ) : part
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 dark:opacity-30 text-center space-y-4">
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
                    className="absolute bottom-full left-6 mb-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden z-50"
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {memberProfiles
                        .filter(p => p.displayName?.toLowerCase().includes(mentionSearch.toLowerCase()))
                        .map(p => (
                          <button 
                            key={p.uid}
                            onClick={() => insertMention(p.displayName || 'User')}
                            className="w-full flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
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

              <form onSubmit={handleSendMessage} className="p-6 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/5 flex items-center gap-3">
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
                  className="p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-black/60 dark:text-white/60"
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
                    isRecording ? "bg-red-500 text-white animate-pulse" : "bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
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
                    className="w-full bg-white dark:bg-black p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all font-medium pr-12"
                  />
                  {isUploading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="animate-spin opacity-40" size={16} />
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={!newMessage.trim() || isRecording || isUploading}
                  className="p-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto opacity-30">
              <BarChart2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Group Progress</h3>
              <p className="opacity-50 max-w-md mx-auto">Share your latest test scores and celebrate milestones together.</p>
            </div>
            <button 
              onClick={() => navigate('/progress')}
              className="px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
            >
              Go to My Progress
            </button>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Shared Assignments</h3>
              <button 
                onClick={() => setIsAddingAssignment(true)}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold hover:scale-105 transition-transform"
              >
                <Plus size={16} />
                Add Assignment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignments.map(assignment => (
                <div key={assignment.id} className="p-8 bg-white dark:bg-black rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4 relative group">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                      <FileText size={20} />
                    </div>
                    {assignment.sharedBy === user?.uid && (
                      <button 
                        onClick={() => deleteDoc(doc(db, 'groups', groupId!, 'assignments', assignment.id))}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">{assignment.title}</h4>
                    <p className="text-sm opacity-50 mt-1">{assignment.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 dark:opacity-40">
                      <Calendar size={12} />
                      Due: {assignment.dueDate ? format(new Date(assignment.dueDate), 'MMM d, yyyy') : 'No date'}
                    </div>
                    <span className="text-[10px] font-bold opacity-50 dark:opacity-30">By {assignment.sharedByName}</span>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-20">
                  <p className="font-bold">No assignments shared yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-8 space-y-6">
            <h3 className="text-2xl font-bold mb-8">Group Members ({group.members.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.members.map((memberId: string) => (
                <MemberCard 
                  key={memberId} 
                  userId={memberId} 
                  isCreator={memberId === group.createdBy} 
                  canKick={isAdmin && memberId !== group.createdBy}
                  onKick={() => kickMember(memberId)}
                  hideAvatar={group.id === 'admin_council'}
                />
              ))}
            </div>
            {group.isPrivate && group.createdBy === user?.uid && (
              <div className="mt-12 p-8 bg-black/5 dark:bg-white/5 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-center">
                <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Invite Code</p>
                <p className="text-4xl font-black tracking-[0.5em]">{group.inviteCode}</p>
                <p className="text-xs opacity-30 mt-4">Share this code with students you want to invite.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Group Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl"
            >
              <h3 className="text-3xl font-bold mb-8">Edit Group Settings</h3>
              <form onSubmit={handleUpdateGroup} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Group Name</label>
                  <input 
                    type="text"
                    required
                    value={editData.name}
                    onChange={e => setEditData({...editData, name: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Description</label>
                  <textarea 
                    value={editData.description}
                    onChange={e => setEditData({...editData, description: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none min-h-[100px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Subject</label>
                    <select 
                      value={editData.subject}
                      onChange={e => setEditData({...editData, subject: e.target.value})}
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Grade Level</label>
                    <select 
                      value={editData.gradeLevel}
                      onChange={e => setEditData({...editData, gradeLevel: e.target.value})}
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                    >
                      {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                  <div className="flex-1">
                    <p className="font-bold">Private Group</p>
                    <p className="text-xs opacity-50">Only members with an invite code can join.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEditData({...editData, isPrivate: !editData.isPrivate})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      editData.isPrivate ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: editData.isPrivate ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white dark:bg-black"
                    />
                  </button>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-8">Share Assignment</h3>
              <form onSubmit={handleAddAssignment} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Title</label>
                  <input 
                    type="text"
                    required
                    value={newAssignment.title}
                    onChange={e => setNewAssignment({...newAssignment, title: e.target.value})}
                    placeholder="e.g. Chapter 5 Practice Problems"
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Description</label>
                  <textarea 
                    value={newAssignment.description}
                    onChange={e => setNewAssignment({...newAssignment, description: e.target.value})}
                    placeholder="Details about the task..."
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none min-h-[100px] resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 ml-2">Due Date</label>
                  <input 
                    type="date"
                    required
                    value={newAssignment.dueDate}
                    onChange={e => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                    className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-2xl focus:outline-none font-bold"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform"
                >
                  Post Assignment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInvite(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Invite Friends</h3>
                <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {friends.length > 0 ? (
                  friends.map(friend => {
                    const isAlreadyMember = group.members.includes(friend.uid);
                    return (
                      <div key={friend.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} className="w-10 h-10 rounded-full" alt="" />
                          <div>
                            <p className="text-sm font-bold">{friend.displayName}</p>
                            <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">{friend.rank}</p>
                          </div>
                        </div>
                        {isAlreadyMember ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">Member</span>
                        ) : (
                          <button 
                            onClick={() => inviteToGroup(friend.uid)}
                            disabled={inviting === friend.uid}
                            className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold hover:scale-105 transition-transform disabled:opacity-50"
                          >
                            {inviting === friend.uid ? <Loader2 className="animate-spin" size={14} /> : 'Invite'}
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 opacity-50">
                    <p className="font-bold">No friends found.</p>
                    <p className="text-xs">Add friends in the Groups section first!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberCard({ userId, isCreator, canKick, onKick, hideAvatar }: { userId: string, isCreator: boolean, canKick?: boolean, onKick?: () => void, hideAvatar?: boolean }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile(snap.data());
    }).catch(err => handleFirestoreError(err, OperationType.GET, `users/${userId}`));
  }, [userId]);

  if (!profile) return <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse h-16" />;

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-black rounded-2xl border border-black/5 dark:border-white/5 group">
      {!hideAvatar && (
        <img 
          src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
          alt="Avatar" 
          className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate text-black dark:text-white">{profile.displayName || 'Anonymous'}</p>
          {isCreator && <Shield size={12} className="text-orange-500" />}
        </div>
        {!hideAvatar && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Level {profile.level || 1} • {profile.rank || 'Welcome'}</p>
        )}
      </div>
      {canKick && (
        <button 
          onClick={onKick}
          className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-xl transition-all"
          title="Kick Member"
        >
          <UserMinus size={16} />
        </button>
      )}
    </div>
  );
}
