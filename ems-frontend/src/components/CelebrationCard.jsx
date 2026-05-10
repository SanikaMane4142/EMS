import React from 'react';
import { Gift, PartyPopper, Award } from 'lucide-react';

const CelebrationCard = ({ celebrations = [] }) => {
  if (celebrations.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-[1px] shadow-lg animate-in fade-in slide-in-from-top duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/95 backdrop-blur-sm p-4 md:p-6 rounded-[15px]">
        
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-inner">
            <PartyPopper size={24} className="animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Today's Celebrations!</h3>
            <p className="text-sm text-slate-500 font-medium">Spreading joy across the workspace</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {celebrations.map((person, idx) => (
            <div 
              key={person.id} 
              className="group flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]"
            >
              {person.avatar_url ? (
                <img src={person.avatar_url} alt={person.full_name} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold shadow-sm">
                  {person.full_name.charAt(0)}
                </div>
              )}
              
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {person.full_name}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                  {person.type === 'birthday' ? (
                    <span className="flex items-center gap-1 text-pink-500">
                      <Gift size={10} /> Birthday
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-indigo-500">
                      <Award size={10} /> {person.years}y Anniversary
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CelebrationCard;
