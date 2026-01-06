import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

@Entity('bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column()
  category!: string;

  @Column({ default: 'Pending' })
  status!: 'Pending' | 'Paid' | 'Rejected';

  @Column({ name: 'billDate', type: 'date' })
  billDate!: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column({ type: 'text', nullable: true })
  fileData?: string; // base64 or url

  @Column({ nullable: true })
  uploadedBy?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedBy' })
  uploader?: User;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
