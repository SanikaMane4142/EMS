import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../services/attendanceService';

export const useActiveAttendance = (userId) => {
  return useQuery({
    queryKey: ['attendance', 'active', userId],
    queryFn: () => attendanceService.getActiveRecord(userId),
    enabled: !!userId,
  });
};

export const useAttendanceHistory = (userId, filters = { limit: 10 }) => {
  return useQuery({
    queryKey: ['attendance', 'history', userId, filters],
    queryFn: () => attendanceService.getAttendanceHistory(userId, filters),
    enabled: !!userId,
  });
};

export const useTodayStats = () => {
  return useQuery({
    queryKey: ['attendance', 'stats', 'today'],
    queryFn: () => attendanceService.getTodayStats(),
  });
};

export const useAttendanceOverview = (filters) => {
  const filterKey = typeof filters === 'string' ? filters : JSON.stringify(filters);
  return useQuery({
    queryKey: ['attendance', 'overview', filterKey],
    queryFn: () => attendanceService.getAttendanceOverview(typeof filters === 'string' ? { date: filters } : filters),
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
    mutationFn: ({ recordId, punchInTime, lunchDurationMs = 0 }) =>
      attendanceService.punchOut(recordId, punchInTime, lunchDurationMs),
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
    mutationFn: (recordId) => attendanceService.startLunchBreak(recordId),
    onSuccess: (data) => {
      const userId = data.user_id;
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active', userId] });
    },
  });
};

export const useResumeWork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, lunchStartTime, currentDurationMs = 0, reason = null }) =>
      attendanceService.endLunchBreak(recordId, lunchStartTime, currentDurationMs, reason),
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

export const useSubmitAbsenceReason = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendanceId, userId, reason }) =>
      attendanceService.submitAbsenceReason(attendanceId, userId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history', data.user_id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] });
    },
  });
};

export const usePendingAbsenceExplanations = (filters = {}) => {
  return useQuery({
    queryKey: ['attendance', 'absences', 'pending', filters],
    queryFn: () => attendanceService.getPendingAbsenceExplanations(filters),
  });
};

export const useReviewAbsenceExplanation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ explanationId, status, reviewerNote = null }) =>
      attendanceService.reviewAbsenceExplanation(explanationId, status, reviewerNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'absences', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history'] });
    },
  });
};

export const useEmployeeDashboardStats = (userId) => {
  return useQuery({
    queryKey: ['attendance', 'stats', 'employee', userId],
    queryFn: () => attendanceService.getEmployeeStats(userId),
    enabled: !!userId,
  });
};
