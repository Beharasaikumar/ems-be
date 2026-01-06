import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvanceColumnsToPayslips1720000000000 implements MigrationInterface {
  name = 'AddAdvanceColumnsToPayslips1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {


    await queryRunner.query(`
      ALTER TABLE payslips
      ADD COLUMN IF NOT EXISTS emergency_advance INTEGER DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE payslips
      ADD COLUMN IF NOT EXISTS advance_recovery INTEGER DEFAULT 0
    `);

   

    await queryRunner.query(`
      ALTER TABLE attendance
      ADD CONSTRAINT fk_attendance_employee
      FOREIGN KEY (employeeid)
      REFERENCES employees(id)
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE leave_requests
      ADD CONSTRAINT fk_leave_employee
      FOREIGN KEY (employeeid)
      REFERENCES employees(id)
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_employeeid_fk
      FOREIGN KEY (employeeId)
      REFERENCES employees(id)
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {


    await queryRunner.query(`
      ALTER TABLE attendance
      DROP CONSTRAINT IF EXISTS fk_attendance_employee
    `);

    await queryRunner.query(`
      ALTER TABLE leave_requests
      DROP CONSTRAINT IF EXISTS fk_leave_employee
    `);

    await queryRunner.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_employeeid_fk
    `);


    await queryRunner.query(`
      ALTER TABLE payslips
      DROP COLUMN IF EXISTS emergency_advance
    `);

    await queryRunner.query(`
      ALTER TABLE payslips
      DROP COLUMN IF EXISTS advance_recovery
    `);
  }
}
