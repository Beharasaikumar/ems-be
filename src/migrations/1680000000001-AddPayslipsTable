import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayslipsTable1680000000001 implements MigrationInterface {
  name = 'AddPayslipsTable1680000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payslips (
        id TEXT PRIMARY KEY,
        "employee_id" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "year" INTEGER,
        "generated_date" TEXT,
        "data" TEXT
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS payslips;
    `);
  }
}
