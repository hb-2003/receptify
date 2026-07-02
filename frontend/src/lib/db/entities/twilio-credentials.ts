import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Business } from './Business';

@Entity('twilio_credentials')
export class TwilioCredentials {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ type: 'uuid', name: 'business_id', unique: true })
  businessId!: string;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business!: Business;

  @Column({ type: 'varchar', name: 'account_sid' })
  accountSid!: string;

  @Column({ type: 'varchar', name: 'auth_token' })
  authToken!: string; // Encrypted

  @Column({ type: 'varchar', name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
