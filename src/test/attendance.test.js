import { describe, it, expect, vi } from 'vitest';
import { attendanceService } from '../services/attendanceService';
import { supabase } from '../lib/supabaseClient';

// Mock Supabase Client to intercept calls
vi.mock('../lib/supabaseClient', () => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'test-record' }, error: null });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        update: mockUpdate
      }),
      rpc: vi.fn()
    }
  };
});

describe('Attendance Service - Shift Timing Changes', () => {
  it('should auto punch-out with a 9-hour limit and 9.5-hour (9h 30m) timestamp shift', async () => {
    const recordId = 'record-123';
    const punchInTime = '2026-06-23T08:00:00.000Z'; // 8:00 AM UTC
    
    await attendanceService.punchOut(recordId, punchInTime, 0, true);
    
    // Verify it called the correct table
    expect(supabase.from).toHaveBeenCalledWith('attendance');
    
    // Verify update arguments
    const mockUpdate = supabase.from('attendance').update;
    expect(mockUpdate).toHaveBeenCalled();
    
    const updateArgs = mockUpdate.mock.calls[0][0];
    
    // 1. Regular paid hours must be capped at exactly 9 (not 8, and not 9.5)
    expect(updateArgs.total_hours).toBe(9);
    
    // 2. Status must be set to auto_punched_out
    expect(updateArgs.status).toBe('auto_punched_out');
    
    // 3. Punch-out timestamp must be exactly punch_in + 9.5 hours (9h 30m)
    // 8:00 AM + 9.5 hours = 5:30 PM (17:30)
    const expectedPunchOut = new Date(new Date(punchInTime).getTime() + 9.5 * 60 * 60 * 1000).toISOString();
    expect(updateArgs.punch_out_time).toBe(expectedPunchOut);
  });
});
