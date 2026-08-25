import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('salary_revisions')
export class SalaryRevision {
  @PrimaryColumn({ name: 'id' })
  id!: string;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @Column({ name: 'effective_date' })
  effectiveDate!: string;

  @Column({ name: 'monthly_gross_salary', type: 'integer' })
  monthlyGrossSalary!: number;

  @Column({ name: 'basic_salary', type: 'integer' })
  basicSalary!: number;

  @Column({ name: 'hra', type: 'integer' })
  hra!: number;

  @Column({ name: 'da', type: 'integer' })
  da!: number;

  @Column({ name: 'special_allowance', type: 'integer' })
  specialAllowance!: number;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt?: Date;
}
