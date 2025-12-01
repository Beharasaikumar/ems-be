import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('payslips')
export class Payslip {
  @PrimaryColumn({ name: 'id' })
  id!: string;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'month' })
  month!: string; // YYYY-MM

  @Column({ name: 'year' })
  year!: number;

  @Column({ name: 'generated_date' })
  generatedDate!: string;

  @Column({ type: 'text' })
  data!: string; // JSON string
}
