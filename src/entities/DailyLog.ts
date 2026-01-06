import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn
} from 'typeorm';
import { User } from './User';

@Entity('admin_daily_logs')
export class DailyLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column()
  category!: 'Note' | 'Report' | 'Update' | 'Reminder';

  @Column({ default: false })
  isPinned!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator?: User;
}
