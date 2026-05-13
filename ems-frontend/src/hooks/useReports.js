import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService } from '../services/reportService';

export const useReports = (dateStr) => {
  return useQuery({
    queryKey: ['reports', dateStr || 'all'],
    queryFn: () => dateStr ? reportService.getReportsByDate(dateStr) : reportService.getAllReports(),
  });
};

export const useReviewReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, reviewerId }) => reportService.reviewReport(id, userId, reviewerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
export const useTodayReport = (userId) => {
  return useQuery({
    queryKey: ['reports', 'today', userId],
    queryFn: () => reportService.getTodayReport(userId),
    enabled: !!userId,
  });
};

export const useSubmitReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reportData }) => reportService.submitDailyReport(userId, reportData),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'today', userId] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'monthly', userId] });
    },
  });
};

export const useMonthlyReportCount = (userId) => {
  return useQuery({
    queryKey: ['reports', 'monthly', userId],
    queryFn: () => reportService.getMonthlyReportCount(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
};
