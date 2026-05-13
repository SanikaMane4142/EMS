import React from 'react';
import { Calendar as CalendarIcon, FileText, Download, Briefcase, CheckSquare, MessageSquare, Send, Search, Paperclip, Smile, MoreVertical } from 'lucide-react';

const MyCalendar = () => {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="card-premium p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="section-title">April 2026</h5>
          <div className="d-flex gap-2">
            <button className="btn-icon-nav"><CalendarIcon size={18}/></button>
            <button className="btn-icon-nav">Today</button>
          </div>
        </div>
        <div className="calendar-grid-modern">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-day-header">{d}</div>)}
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className={`cal-day-cell ${i + 1 === 28 ? 'today' : ''} ${[5, 6, 12, 13, 19, 20, 26, 27].includes(i) ? 'weekend' : ''}`}>
              <span className="day-num">{i + 1}</span>
              {i + 1 === 15 && <div className="cal-event holiday">Good Friday</div>}
              {i + 1 === 29 && <div className="cal-event leave">Sick Leave</div>}
            </div>
          ))}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .calendar-grid-modern { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border-color); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
        .cal-day-header { background: #f8fafc; padding: 12px; text-align: center; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .cal-day-cell { background: #fff; min-height: 100px; padding: 8px; position: relative; }
        .cal-day-cell.weekend { background: #fcfdfe; }
        .cal-day-cell.today { background: #f5f3ff; }
        .cal-day-cell.today .day-num { background: var(--primary); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
        .day-num { font-size: 13px; font-weight: 600; color: var(--text-main); }
        .cal-event { font-size: 10px; padding: 4px 8px; border-radius: 4px; margin-top: 4px; font-weight: 700; }
        .cal-event.holiday { background: #fee2e2; color: #991b1b; border-left: 3px solid #ef4444; }
        .cal-event.leave { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; }
      `}} />
    </div>
  );
};

const MyDocuments = () => {
  const docs = [
    { name: 'Offer_Letter_Jane_Doe.pdf', type: 'PDF', size: '1.2 MB', date: '12 Jan, 2024' },
    { name: 'Payslip_March_2026.pdf', type: 'PDF', size: '450 KB', date: '01 Apr, 2026' },
    { name: 'Policy_Manual_2026.pdf', type: 'PDF', size: '2.5 MB', date: '05 Jan, 2026' },
  ];

  return (
    <div className="card-premium">
      <div className="p-4">
        <h5 className="section-title mb-4">Personal Documents</h5>
        <div className="d-flex flex-column gap-3">
          {docs.map((doc, i) => (
            <div key={i} className="document-row p-3 rounded-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <div className="doc-icon-box"><FileText size={20} className="text-primary"/></div>
                <div>
                  <h6 className="fw-bold mb-0" style={{ fontSize: '14px' }}>{doc.name}</h6>
                  <p className="text-muted small mb-0">{doc.type} • {doc.size} • Uploaded on {doc.date}</p>
                </div>
              </div>
              <button className="btn-icon-action"><Download size={18}/></button>
            </div>
          ))}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .document-row { background: #f8fafc; border: 1px solid #f1f5f9; transition: all 0.2s; }
        .document-row:hover { border-color: var(--primary); background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
        .doc-icon-box { width: 40px; height: 40px; background: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #f1f5f9; }
      `}} />
    </div>
  );
};

const MyTasks = () => {
  const tasks = [
    { title: 'Implement Sidebar for Employee Hub', status: 'In Progress', priority: 'High', due: '28 Apr' },
    { title: 'Fix Login authentication bug', status: 'Done', priority: 'Critical', due: '27 Apr' },
    { title: 'Update Performance Metrics Chart', status: 'Pending', priority: 'Medium', due: '30 Apr' },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="card-premium p-4">
        <h5 className="section-title mb-4">Assigned Tasks</h5>
        <div className="d-flex flex-column gap-3">
          {tasks.map((task, i) => (
            <div key={i} className="task-card p-3 rounded-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <CheckSquare size={20} className={task.status === 'Done' ? 'text-success' : 'text-muted'} />
                <div>
                  <h6 className={`fw-bold mb-0 ${task.status === 'Done' ? 'text-decoration-line-through text-muted' : ''}`} style={{ fontSize: '14px' }}>{task.title}</h6>
                  <div className="d-flex gap-2 mt-1">
                    <span className="badge bg-light text-muted border small" style={{ fontSize: '10px' }}>Due: {task.due}</span>
                    <span className={`badge ${task.priority === 'Critical' ? 'bg-danger' : task.priority === 'High' ? 'bg-warning text-dark' : 'bg-primary'} small`} style={{ fontSize: '10px' }}>{task.priority}</span>
                  </div>
                </div>
              </div>
              <span className={`small fw-bold ${task.status === 'In Progress' ? 'text-primary' : 'text-muted'}`}>{task.status}</span>
            </div>
          ))}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .task-card { background: #fcfdfe; border: 1px solid var(--border-color); transition: all 0.2s; }
        .task-card:hover { transform: translateX(4px); border-color: var(--primary); }
      `}} />
    </div>
  );
};

const ChatModule = () => {
  return (
    <div className="card-premium p-0 overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
      <div className="row g-0 h-100">
        <div className="col-md-4 border-end d-flex flex-column">
          <div className="p-3 border-bottom">
            <div className="position-relative">
              <Search className="position-absolute text-muted" size={16} style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" className="form-input ps-5" placeholder="Search chats..." style={{ height: '36px' }} />
            </div>
          </div>
          <div className="flex-grow-1 overflow-auto">
            {[
              { name: 'HR Manager', last: 'Your leave has been approved.', time: '10m', active: true },
              { name: 'Frontend Team', last: 'Alice: Let\'s sync up at 2 PM.', time: '1h' },
            ].map((chat, i) => (
              <div key={i} className={`p-3 d-flex align-items-center gap-3 border-bottom cursor-pointer chat-item ${chat.active ? 'active' : ''}`}>
                <div className="avatar-sm">{chat.name.charAt(0)}</div>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between"><span className="fw-bold small">{chat.name}</span><span className="text-muted" style={{ fontSize: '10px' }}>{chat.time}</span></div>
                  <p className="text-muted small mb-0 text-truncate" style={{ maxWidth: '180px' }}>{chat.last}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-md-8 d-flex flex-column">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="avatar-sm">H</div>
              <h6 className="fw-bold m-0">HR Manager</h6>
            </div>
            <button className="btn p-0 text-muted"><MoreVertical size={20}/></button>
          </div>
          <div className="flex-grow-1 p-4 bg-light overflow-auto d-flex flex-column gap-3">
            <div className="msg-received">Hi Jane, I've reviewed your request.</div>
            <div className="msg-sent">Thank you! When can I expect the update?</div>
            <div className="msg-received">Your leave has been approved. Enjoy your break!</div>
          </div>
          <div className="p-3 border-top d-flex gap-2 bg-white">
            <button className="btn-icon-nav"><Paperclip size={20}/></button>
            <input type="text" className="form-input flex-grow-1" placeholder="Type your message..." />
            <button className="btn btn-primary px-3" style={{ borderRadius: '10px' }}><Send size={18}/></button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .chat-item { transition: all 0.2s; cursor: pointer; }
        .chat-item:hover { background: #f8fafc; }
        .chat-item.active { background: #eef2ff; border-left: 4px solid var(--primary); }
        .msg-received { align-self: flex-start; background: #fff; padding: 10px 16px; border-radius: 12px 12px 12px 0; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); max-width: 80%; }
        .msg-sent { align-self: flex-end; background: var(--primary); color: #fff; padding: 10px 16px; border-radius: 12px 12px 0 12px; font-size: 14px; max-width: 80%; }
        .cursor-pointer { cursor: pointer; }
      `}} />
    </div>
  );
};

export { MyCalendar, MyDocuments, MyTasks, ChatModule };
