import React from 'react';
import { BarChart3, TrendingUp, Target, Star, Award, Zap, Users, Phone, Mail, MessageCircle, MapPin, Globe, Linkedin, Twitter, Camera } from 'lucide-react';

const MyAnalytics = () => {
  return (
    <div className="d-flex flex-column gap-4">
      {/* KPI Row */}
      <div className="row g-3">
        {[
          { label: 'Work Consistency', value: '94%', icon: <TrendingUp size={20}/>, color: 'var(--success)', bg: '#f0fdf4' },
          { label: 'Tasks Completed', value: '42', icon: <Target size={20}/>, color: 'var(--primary)', bg: '#f5f3ff' },
          { label: 'Peer Rating', value: '4.8', icon: <Star size={20}/>, color: 'var(--warning)', bg: '#fffbeb' },
          { label: 'Skill Points', value: '1,250', icon: <Award size={20}/>, color: 'var(--info)', bg: '#eff6ff' },
        ].map((kpi, i) => (
          <div className="col-md-3" key={i}>
            <div className="card-premium p-4 text-center">
              <div className="mx-auto mb-2 stat-icon-box-large" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</div>
              <div className="fw-800 h4 mb-0">{kpi.value}</div>
              <div className="text-muted small fw-bold">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-premium p-4">
            <h5 className="section-title mb-4">Attendance Trends</h5>
            <div className="d-flex align-items-end gap-2" style={{ height: '200px', padding: '0 20px' }}>
              {[60, 45, 80, 70, 90, 85, 95, 75, 85, 90, 80, 88].map((h, i) => (
                <div key={i} className="flex-grow-1 bg-primary opacity-75 rounded-top" style={{ height: `${h}%`, minWidth: '10px' }}></div>
              ))}
            </div>
            <div className="d-flex justify-content-between mt-3 text-muted small px-3 fw-bold">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-premium p-4">
            <h5 className="section-title mb-4">Task Breakdown</h5>
            <div className="d-flex flex-column gap-3">
              {[
                { label: 'Feature Dev', val: 65, color: 'var(--primary)' },
                { label: 'Bug Fixing', val: 20, color: 'var(--danger)' },
                { label: 'Code Review', val: 15, color: 'var(--warning)' },
              ].map((task, i) => (
                <div key={i}>
                  <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span>{task.label}</span>
                    <span>{task.val}%</span>
                  </div>
                  <div className="progress" style={{ height: '6px', background: '#f1f5f9' }}>
                    <div className="progress-bar" style={{ width: `${task.val}%`, background: task.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .stat-icon-box-large { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
      `}} />
    </div>
  );
};

const MyTeam = () => {
  const team = [
    { name: 'Alice Smith', role: 'Frontend Lead', status: 'Online', initial: 'AS', color: '#4f46e5' },
    { name: 'Mike Ross', role: 'Backend Dev', status: 'Working', initial: 'MR', color: '#10b981' },
    { name: 'Sarah Wilson', role: 'UI Designer', status: 'On Leave', initial: 'SW', color: '#f59e0b' },
    { name: 'James Miller', role: 'Full Stack', status: 'Online', initial: 'JM', color: '#ef4444' },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-4">
        {team.map((member, i) => (
          <div className="col-md-6 col-lg-4" key={i}>
            <div className="card-premium p-4 team-member-card">
              <div className="d-flex align-items-center gap-3 mb-4">
                <div className="avatar-xl" style={{ background: `${member.color}20`, color: member.color }}>{member.initial}</div>
                <div>
                  <h6 className="fw-800 mb-0">{member.name}</h6>
                  <p className="text-muted small fw-bold mb-0">{member.role}</p>
                </div>
                <div className={`status-dot ms-auto ${member.status.toLowerCase().replace(' ', '-')}`}></div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn-icon-action flex-grow-1"><Mail size={16}/> Email</button>
                <button className="btn-icon-action flex-grow-1"><MessageCircle size={16}/> Chat</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .avatar-xl { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; }
        .status-dot.online { background: var(--success); box-shadow: 0 0 0 3px #dcfce7; }
        .status-dot.working { background: var(--primary); box-shadow: 0 0 0 3px #e0e7ff; }
        .status-dot.on-leave { background: var(--warning); box-shadow: 0 0 0 3px #fef3c7; }
        .team-member-card { border: 1px solid var(--border-color); transition: all 0.2s; }
        .team-member-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
      `}} />
    </div>
  );
};

const MyProfile = () => {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="card-premium p-0 overflow-hidden">
        <div className="profile-banner"></div>
        <div className="px-4 pb-4" style={{ marginTop: '-40px' }}>
          <div className="d-flex align-items-end justify-content-between mb-4">
            <div className="position-relative">
              <div className="profile-avatar-giant">JD</div>
              <button className="btn-camera-abs"><Camera size={16}/></button>
            </div>
            <button className="btn btn-primary fw-bold px-4" style={{ borderRadius: '10px' }}>Edit Profile</button>
          </div>
          <div className="row g-4">
            <div className="col-lg-4">
              <h3 className="fw-800 mb-1">Jane Doe</h3>
              <p className="text-muted fw-bold small text-uppercase">Senior Software Engineer</p>
              <div className="d-flex flex-column gap-3 mt-4">
                <div className="d-flex align-items-center gap-3 text-muted small fw-bold">
                  <MapPin size={16} className="text-primary"/> San Francisco, CA
                </div>
                <div className="d-flex align-items-center gap-3 text-muted small fw-bold">
                  <Globe size={16} className="text-primary"/> portfolio.janedoe.com
                </div>
                <div className="d-flex gap-2 mt-2">
                  <button className="btn-social"><Linkedin size={18}/></button>
                  <button className="btn-social"><Twitter size={18}/></button>
                </div>
              </div>
            </div>
            <div className="col-lg-8 border-start ps-lg-5">
              <div className="row g-4">
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">EMAIL ADDRESS</label>
                  <p className="fw-bold">jane.doe@ems.pro</p>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">PHONE NUMBER</label>
                  <p className="fw-bold">+1 (555) 0123 4567</p>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">DEPARTMENT</label>
                  <p className="fw-bold">AIML Engineering</p>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-bold">JOIN DATE</label>
                  <p className="fw-bold">12 Jan, 2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .profile-banner { height: 160px; background: linear-gradient(135deg, var(--primary) 0%, #3730a3 100%); }
        .profile-avatar-giant { width: 120px; height: 120px; border-radius: 30px; background: #fff; color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 40px; border: 6px solid #fff; box-shadow: var(--shadow-lg); }
        .btn-camera-abs { position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; border-radius: 50%; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); cursor: pointer; color: var(--text-muted); }
        .btn-social { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--border-color); background: #fff; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .btn-social:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-2px); }
      `}} />
    </div>
  );
};

export { MyAnalytics, MyTeam, MyProfile };
