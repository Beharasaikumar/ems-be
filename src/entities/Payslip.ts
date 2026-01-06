import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('payslips')
export class Payslip {
  @PrimaryColumn({ name: 'id' })
  id!: string;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'month' })
  month!: string;

  @Column({ name: 'year' })
  year!: number;

  @Column({ name: 'generated_date' })
  generatedDate!: string;

  @Column({ name: 'emergency_advance', type: 'integer', default: 0 })
  emergencyAdvance!: number;

  @Column({ name: 'advance_recovery', type: 'integer', default: 0 })
  advanceRecovery!: number;

  @Column({ type: 'text' })
  data!: string; 
}
