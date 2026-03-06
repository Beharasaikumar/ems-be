import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEsiEnabledColumn1680000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees 
      ADD COLUMN IF NOT EXISTS esienabled BOOLEAN DEFAULT TRUE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees 
      DROP COLUMN IF EXISTS esienabled;
    `);
  }
}