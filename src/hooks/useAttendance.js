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
    mutationFn: ({ recordId, punchInTime, lunchDurationMs = 0, isAutoPunchOut = false }) =>
      attendanceService.punchOut(recordId, punchInTime, lunchDurationMs, isAutoPunchOut),
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

export const useIpValidity = () => {
  return useQuery({
    queryKey: ['attendance', 'ip_validity'],
    queryFn: () => attendanceService.checkIpValidity(),
    refetchInterval: 30000, // Check every 30s
  });
};

/**
 * Poll the office_ip_heartbeat table every 60s.
 * Used by IpManagement.jsx to show live heartbeat health status.
 */
export const useHeartbeatStatus = () => {
  return useQuery({
    queryKey: ['attendance', 'heartbeat_status'],
    queryFn: () => attendanceService.getHeartbeatStatus(),
    refetchInterval: 60000, // Refresh every 60s
  });
};

/**
 * Fetch the IP change audit log (admin/HR only).
 */
export const useIpChangeLogs = (limit = 30) => {
  return useQuery({
    queryKey: ['attendance', 'ip_change_logs', limit],
    queryFn: () => attendanceService.getIpChangeLogs(limit),
  });
};

export const useAuthorizedEarlyPunchOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendanceId, reason, note, markFullDay }) =>
      attendanceService.authorizedEarlyPunchOut(attendanceId, reason, note, markFullDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'override_logs'] });
    },
  });
};

export const useOverrideLogs = (attendanceId) => {
  return useQuery({
    queryKey: ['attendance', 'override_logs', attendanceId],
    queryFn: () => attendanceService.getOverrideLogs(attendanceId),
    enabled: !!attendanceId,
  });
};

export const useSubmitEarlyExitRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, attendanceId, reason, note }) =>
      attendanceService.submitEarlyExitRequest(employeeId, attendanceId, reason, note),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'early_exit_requests', 'my', variables.attendanceId] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'early_exit_requests', 'pending'] });
    },
  });
};

export const useMyEarlyExitRequest = (attendanceId) => {
  return useQuery({
    queryKey: ['attendance', 'early_exit_requests', 'my', attendanceId],
    queryFn: () => attendanceService.getMyEarlyExitRequest(attendanceId),
    enabled: !!attendanceId,
  });
};

export const usePendingEarlyExitRequests = () => {
  return useQuery({
    queryKey: ['attendance', 'early_exit_requests', 'pending'],
    queryFn: () => attendanceService.getPendingEarlyExitRequests(),
  });
};

export const useReviewEarlyExitRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status, reviewerNote, markFullDay }) =>
      attendanceService.reviewEarlyExitRequest(requestId, status, reviewerNote, markFullDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useEmployeeApprovedEarlyPunchOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendanceId }) => attendanceService.employeeApprovedEarlyPunchOut(attendanceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      // Reset active attendance to null so UI knows they are punched out
      queryClient.setQueryData(['attendance', 'active', data.user_id], null);
    },
  });
};
