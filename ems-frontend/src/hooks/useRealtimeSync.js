import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

/**
 * Global hook to listen for database changes via Supabase Realtime
 * and automatically invalidate React Query cache to keep UI in sync.
 */
export const useRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('📡 Initializing Supabase Realtime sync...');

    // 1. Listen for ALL changes to critical tables
    const channel = supabase
      .channel('global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('🔄 Tasks changed:', payload.eventType);
          // Invalidate all task-related queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task-subtasks'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_groups' },
        (payload) => {
          console.log('🔄 Task groups changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtasks' },
        (payload) => {
          console.log('🔄 Subtasks changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['task-subtasks'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload) => {
          console.log('🔄 Attendance changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('🔄 Notifications changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime Status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('📡 Closing Realtime sync...');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
