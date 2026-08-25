import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSalaryRevisionsTable1730000000000 implements MigrationInterface {
  name = 'CreateSalaryRevisionsTable1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_revisions (
        id TEXT PRIMARY KEY,
        "employee_id" TEXT NOT NULL,
        "effective_date" TEXT NOT NULL,
        "monthly_gross_salary" INTEGER NOT NULL DEFAULT 0,
        "basic_salary" INTEGER NOT NULL DEFAULT 0,
        "hra" INTEGER NOT NULL DEFAULT 0,
        "da" INTEGER NOT NULL DEFAULT 0,
        "special_allowance" INTEGER NOT NULL DEFAULT 0,
        "reason" TEXT,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT fk_salary_revision_employee FOREIGN KEY ("employee_id") REFERENCES employees(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS salary_revisions;
    `);
  }
}
