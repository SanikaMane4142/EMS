export const EIGHT_HOUR_EMPLOYEES = ['FS-CO002', 'AI-CO004', 'UIUX-CO007'];

/**
 * Returns the shift configuration for a given employee ID.
 * @param {string} employeeId - The unique employee ID (e.g., 'FS-CO002')
 * @returns {object} - Shift configuration including shiftHours, SHIFT_MS, and AUTO_PUNCH_OUT_MS
 */
export const getShiftConfig = (employeeId) => {
  const is8HourEmployee = EIGHT_HOUR_EMPLOYEES.includes(employeeId);
  const shiftHours = is8HourEmployee ? 8 : 9;
  
  return {
    shiftHours,
    SHIFT_MS: shiftHours * 60 * 60 * 1000,
    AUTO_PUNCH_OUT_MS: (shiftHours + 0.5) * 60 * 60 * 1000,
  };
};
