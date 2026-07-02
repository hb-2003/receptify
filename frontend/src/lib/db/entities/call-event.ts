import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Call } from './Call';

@Entity('call_events')
export class CallEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ type: 'uuid', name: 'call_id' })
  callId!: string;

  @ManyToOne(() => Call, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'call_id' })
  call!: Call;

  @Column({ type: 'varchar', name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'payload' })
  payload?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
