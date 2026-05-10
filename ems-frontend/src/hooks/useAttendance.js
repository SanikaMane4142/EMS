import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../services/attendanceService';

export const useActiveAttendance = (userId) => {
  return useQuery({
    queryKey: ['attendance', 'active', userId],
    queryFn: () => attendanceService.getActiveRecord(userId),
    enabled: !!userId,
  });
};

export const useAttendanceHistory = (userId, limit = 10) => {
  return useQuery({
    queryKey: ['attendance', 'history', userId, limit],
    queryFn: () => attendanceService.getAttendanceHistory(userId, limit),
    enabled: !!userId,
  });
};

export const useTodayStats = () => {
  return useQuery({
    queryKey: ['attendance', 'stats', 'today'],
    queryFn: () => attendanceService.getTodayStats(),
  });
};

export const useAttendanceOverview = (dateStr) => {
  return useQuery({
    queryKey: ['attendance', 'overview', dateStr],
    queryFn: () => attendanceService.getAttendanceOverview(dateStr),
  });
};

export const useAttendanceTrends = () => {
  return useQuery({
    queryKey: ['attendance', 'trends'],
    queryFn: () => attendanceService.getAttendanceTrends(),
  });
};

export const usePunchIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => attendanceService.punchIn(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history', userId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] });
    },
  });
};

export const usePunchOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, punchInTime }) => attendanceService.punchOut(recordId, punchInTime),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history', userId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] });
    },
  });
};
export const useStartLunch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId) => attendanceService.startLunch(recordId),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
    },
  });
};

export const useResumeWork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, reason }) => attendanceService.resumeWork(recordId, reason),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
    },
  });
};

export const useStartOvertime = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId) => attendanceService.startOvertime(recordId),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
    },
  });
};

export const useEndOvertime = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, startTime }) => attendanceService.endOvertime(recordId, startTime),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
    },
  });
};
