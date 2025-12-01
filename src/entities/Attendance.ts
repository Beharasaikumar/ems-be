import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('attendance')
@Index(['employeeId', 'date'], { unique: true })
export class Attendance {
  @PrimaryColumn({name: 'id' })
  id!: string;

  @Column({ name: 'employeeid' })
  employeeId!: string;

  @Column({ name: 'date' })
  date!: string; // format: YYYY-MM-DD

  @Column({ name: 'status' })
  status!: string; // 'Present' | 'Absent' | 'Half Day' | 'Leave' | custom
}
