import { Pool } from 'pg';
import { config } from '../Config/Config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function assertDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
