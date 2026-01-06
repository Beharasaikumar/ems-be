import { MigrationInterface, QueryRunner } from "typeorm";

export class DailyLogMigration1700000000003 implements MigrationInterface {
  name = 'DailyLogMigration1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_daily_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR NOT NULL,
        "isPinned" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT now(),
        "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE admin_daily_logs`);
  }
}
