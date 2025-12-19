import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLeaveRequestsTable1690000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY,
        employeeid TEXT NOT NULL,
        type TEXT NOT NULL,
        startdate DATE NOT NULL,
        enddate DATE NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'Pending',
        appliedon TIMESTAMPTZ DEFAULT NOW(),
        decidedon TIMESTAMPTZ,

        CONSTRAINT fk_leave_employee
          FOREIGN KEY (employeeid)
          REFERENCES employees(id)
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_employee
      ON leave_requests(employeeid);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_status
      ON leave_requests(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS leave_requests;`);
  }
}
