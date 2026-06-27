import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { User } from './entities/User';
import { Business } from './entities/Business';
import { Customer } from './entities/Customer';
import { Campaign } from './entities/Campaign';
import { CampaignCustomer } from './entities/CampaignCustomer';
import { Script } from './entities/Script';
import { Template } from './entities/Template';
import { Call } from './entities/Call';
import { CallTranscript } from './entities/CallTranscript';
import { CallRecording } from './entities/CallRecording';
import { BillingPlan } from './entities/BillingPlan';
import { Subscription } from './entities/Subscription';
import { UsageLog } from './entities/UsageLog';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'receptify',
  password: process.env.DB_PASSWORD || 'receptify_pass',
  database: process.env.DB_NAME || 'receptify',
  synchronize: false,
  logging: false,
  entities: [
    User, Business, Customer, Campaign, CampaignCustomer, Script, Template,
    Call, CallTranscript, CallRecording, BillingPlan, Subscription, UsageLog,
  ],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
});

let initPromise: Promise<DataSource> | null = null;
export async function getDB(): Promise<DataSource> {
  if (AppDataSource.isInitialized) return AppDataSource;
  if (!initPromise) initPromise = AppDataSource.initialize();
  return initPromise;
}

// TypeORM CLI requires exactly one DataSource export. We expose ONLY the default.
export default AppDataSource;
