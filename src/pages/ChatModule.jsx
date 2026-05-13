import React from 'react';
import { Send, Search, Paperclip, MoreVertical } from 'lucide-react';
import { Box, Avatar, IconButton } from '@mui/material';
import PageHeader from '../components/PageHeader';

const ChatModule = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <PageHeader title="Messages" subtitle="Connect with your team and HR" />

      <Box className="card-ems-static flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-1/3 border-r border-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" className="form-input-ems pl-10 h-10" placeholder="Search chats..." />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {[
              { name: 'HR Manager', last: 'Your leave has been approved.', time: '10m', active: true },
              { name: 'Frontend Team', last: 'Alice: Let\'s sync up at 2 PM.', time: '1h' },
            ].map((chat, i) => (
              <div key={i} className={`p-4 flex items-center gap-3 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${chat.active ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : ''}`}>
                <Avatar sx={{ bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700, fontSize: 14 }}>{chat.name.charAt(0)}</Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-sm font-bold text-slate-900 truncate">{chat.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{chat.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{chat.last}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/30">
          <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Avatar sx={{ bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 700 }}>H</Avatar>
              <div>
                <h6 className="text-sm font-bold text-slate-900 m-0">HR Manager</h6>
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Online</p>
              </div>
            </div>
            <IconButton size="small"><MoreVertical size={18}/></IconButton>
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
            <div className="self-start max-w-[80%]">
              <div className="bg-white p-3.5 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 text-sm text-slate-700">
                Hi Jane, I've reviewed your request.
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 ml-1">09:15 AM</span>
            </div>

            <div className="self-end max-w-[80%]">
              <div className="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-br-none shadow-md text-sm">
                Thank you! When can I expect the update?
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 mr-1 text-right block">09:16 AM</span>
            </div>

            <div className="self-start max-w-[80%]">
              <div className="bg-white p-3.5 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 text-sm text-slate-700">
                Your leave has been approved. Enjoy your break!
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 ml-1">09:20 AM</span>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <IconButton className="!bg-slate-50"><Paperclip size={18}/></IconButton>
            <input type="text" className="form-input-ems h-11" placeholder="Type your message..." />
            <button className="btn-ems btn-ems-primary px-5 h-11"><Send size={18}/></button>
          </div>
        </div>
      </Box>
    </div>
  );
};

export default ChatModule;
