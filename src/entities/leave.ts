import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn
} from 'typeorm';


@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'employeeid' })
  employeeId!: string;

  @Column()
  type!: string;

  @Column({ name: 'startdate' })
  startDate!: string;

  @Column({ name: 'enddate' })
  endDate!: string;

  @Column({ nullable: true })
  reason?: string;

  @Column({ default: 'Pending' })
  status!: 'Pending' | 'Approved' | 'Rejected';

  @CreateDateColumn({ name: 'appliedon', type: 'timestamptz' })
  appliedOn!: Date;

  @Column({ name: 'decidedon', type: 'timestamptz', nullable: true })
  decidedOn?: Date;
}
