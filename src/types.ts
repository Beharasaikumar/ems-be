export type Employee = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  joinDate?: string; // YYYY-MM-DD
  pan?: string;
  basicSalary?: number;
  hra?: number;
  da?: number;
  specialAllowance?: number;
  bankAccountNumber?: string;
  pfAccountNumber?: string;
  esiNumber?: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | string;
};

export type Payslip = {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  year: number;
  generatedDate: string;
  attendancePercentage: number;
  earnings: {
    basic: number;
    hra: number;
    da: number;
    specialAllowance: number;
    gross: number;
  };
  deductions: {
    pf: number;
    esi: number;
    pt: number;
    tax: number;
    totalDeductions: number;
  };
  netSalary: number;
  remarks?: string;
};
