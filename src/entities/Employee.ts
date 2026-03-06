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

  @Column({ name: 'monthlygrosssalary', type: 'integer', nullable: true })
  monthlyGrossSalary?: number;

  @Column({ name: 'basicsalary', type: 'integer', nullable: true })
  basicSalary?: number;

  @Column({ name: 'hra', type: 'integer', nullable: true })
  hra?: number;

  @Column({ name: 'da', type: 'integer', nullable: true })
  da?: number;

  @Column({ name: 'specialallowance', type: 'integer', nullable: true })
  specialAllowance?: number;

  // @Column({ name: 'sickleave', type: 'integer', default: 10 })
  // sickleave!: number;

  // @Column({ name: 'casualleave', type: 'integer', default: 10 })
  // casualleave!: number;

  // @Column({ name: 'paidleave', type: 'integer', default: 15 })
  // paidleave!: number;

  @Column({ name: 'bankaccountnumber', nullable: true })
  bankAccountNumber?: string;

  @Column({ name: 'pfaccountnumber', nullable: true })
  pfAccountNumber?: string;

  @Column({ name: 'esinumber', nullable: true })
  esiNumber?: string;

  @Column({ name: 'esienabled', default: true })
  esiEnabled!: boolean;

  @Column({ name: 'pfenabled', default: true })
  pfEnabled!: boolean;

  @Column({ name: 'approle', default: 'employee' })
  appRole!: 'employee' | 'admin';

  @CreateDateColumn({ name: 'createdat', type: 'timestamptz', nullable: true })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updatedat', type: 'timestamptz', nullable: true })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deletedat', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
