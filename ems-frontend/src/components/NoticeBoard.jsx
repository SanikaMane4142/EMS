import React, { useState } from 'react';
import { Megaphone, ChevronRight, Info, AlertTriangle, Zap, X } from 'lucide-react';

const NoticeBoard = ({ announcements = [] }) => {
  const [selectedNotice, setSelectedNotice] = useState(null);

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'urgent':
        return { 
          icon: Zap, 
          color: 'text-rose-600', 
          bg: 'bg-rose-50', 
          border: 'border-rose-100',
          badge: 'bg-rose-600 text-white' 
        };
      case 'important':
        return { 
          icon: AlertTriangle, 
          color: 'text-amber-600', 
          bg: 'bg-amber-50', 
          border: 'border-amber-100',
          badge: 'bg-amber-600 text-white' 
        };
      default:
        return { 
          icon: Info, 
          color: 'text-blue-600', 
          bg: 'bg-blue-50', 
          border: 'border-blue-100',
          badge: 'bg-blue-600 text-white' 
        };
    }
  };

  // Helper to strip HTML tags for preview snippet
  const stripHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
      <div className="p-6 border-b border-[#F3F4F6] flex items-center justify-between bg-gradient-to-r from-white to-[#F8FAFC]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#5B21F6] text-white rounded-xl flex items-center justify-center shadow-lg shadow-purple-100">
            <Megaphone size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[#111827] text-lg">Notice Board</h3>
            <p className="text-[11px] text-[#6B7280] font-medium uppercase tracking-widest">Global Announcements</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-tight bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
             Live
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ maxHeight: '520px' }}>
        {announcements.map((notice) => {
          const styles = getPriorityStyles(notice.priority);
          const Icon = styles.icon;
          return (
            <div
              key={notice.id}
              onClick={() => setSelectedNotice(notice)}
              className={`group relative flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:bg-white hover:shadow-[0_8px_25px_rgba(0,0,0,0.05)] border border-transparent hover:border-[#E5E7EB] ${styles.bg} border-opacity-50`}
            >
              <div className={`mt-0.5 w-10 h-10 flex-shrink-0 rounded-xl bg-white shadow-sm flex items-center justify-center ${styles.color} border border-[#F3F4F6] group-hover:scale-110 transition-transform`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="text-[15px] font-bold text-[#111827] truncate group-hover:text-[#5B21F6] transition-colors">
                    {notice.title}
                  </h4>
                  <span className="text-[11px] font-medium text-[#9CA3AF] whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-[#F3F4F6]">
                    {new Date(notice.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-[13px] text-[#6B7280] line-clamp-1 leading-relaxed opacity-80">
                  {stripHtml(notice.content)}
                </p>
              </div>
              <div className="self-center w-8 h-8 flex items-center justify-center rounded-full bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-[#F3F4F6]">
                <ChevronRight size={14} className="text-[#5B21F6]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Notice Detail Modal - Glassmorphism Redesign */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300"
             container={() => document.getElementById('root')}>
          <div className="bg-white/95 w-full max-w-xl rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.25)] overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
            <div className={`h-2 w-full ${getPriorityStyles(selectedNotice.priority).badge} opacity-80`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center border border-[#F3F4F6] ${getPriorityStyles(selectedNotice.priority).color}`}>
                    {React.createElement(getPriorityStyles(selectedNotice.priority).icon, { size: 28 })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ${getPriorityStyles(selectedNotice.priority).badge} shadow-sm`}>
                        {selectedNotice.priority}
                      </span>
                      <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#F3F4F6]">
                        Official
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-[#111827] leading-tight">
                      {selectedNotice.title}
                    </h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNotice(null)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-[#F3F4F6] rounded-full text-[#9CA3AF] transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-[#F8FAFC] rounded-3xl p-6 border border-[#F3F4F6] mb-8">
                <div 
                  className="text-[#374151] leading-[1.8] text-[16px] prose prose-indigo max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
                />
              </div>

              <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-[#F3F4F6] shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-[#7C3AED] to-[#5B21F6] text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md shadow-purple-100">
                    {selectedNotice.author?.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-[#111827]">
                      {selectedNotice.author?.full_name || 'System Administrator'}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wider">Verified Official</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-0.5">Publish Date</p>
                  <span className="text-[12px] font-bold text-[#4B5563]">
                    {new Date(selectedNotice.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedNotice(null)}
                className="w-full mt-8 py-4 bg-[#111827] text-white font-bold rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.15)] hover:bg-black hover:-translate-y-0.5 transition-all active:scale-[0.98]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
