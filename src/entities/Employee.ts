import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryColumn({ name: 'id' })
  id!: string;

  @Column({ name: 'name' })
  name!: string;

  @Column({ name: 'email', nullable: true })
  email?: string;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'role', nullable: true })
  role?: string;

  @Column({ name: 'department', nullable: true })
  department?: string;

  // DB column is lowercased (joindate) so we map to that
  @Column({ name: 'joindate', nullable: true })
  joinDate?: string;

  @Column({ name: 'pan', nullable: true })
  pan?: string;

  @Column({ name: 'basicsalary', type: 'integer', nullable: true })
  basicSalary?: number;

  @Column({ name: 'hra', type: 'integer', nullable: true })
  hra?: number;

  @Column({ name: 'da', type: 'integer', nullable: true })
  da?: number;

  @Column({ name: 'specialallowance', type: 'integer', nullable: true })
  specialAllowance?: number;

  @Column({ name: 'bankaccountnumber', nullable: true })
  bankAccountNumber?: string;

  @Column({ name: 'pfaccountnumber', nullable: true })
  pfAccountNumber?: string;

  @Column({ name: 'esinumber', nullable: true })
  esiNumber?: string;

  @Column({ name: 'approle', default: 'employee' })
  appRole!: 'employee' | 'admin';

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt?: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updatedAt?: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
