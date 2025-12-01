import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialTables1680000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT,
        department TEXT,
        joinDate TEXT,
        pan TEXT,
        basicSalary INTEGER,
        hra INTEGER,
        da INTEGER,
        specialAllowance INTEGER,
        bankAccountNumber TEXT,
        pfAccountNumber TEXT,
        esiNumber TEXT,
        appRole TEXT DEFAULT 'employee',
        createdAt TIMESTAMPTZ DEFAULT NOW(),
        updatedAt TIMESTAMPTZ DEFAULT NOW(),
        deletedAt TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_att_employee_date ON attendance(employeeId, date);`);

    // await queryRunner.query(`
    //   CREATE TABLE IF NOT EXISTS payslips (
    //     id TEXT PRIMARY KEY,
    //     employeeId TEXT NOT NULL,
    //     month TEXT NOT NULL,
    //     year INTEGER,
    //     generatedDate TEXT,
    //     data TEXT
    //   );
    // `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // await queryRunner.query(`DROP TABLE IF EXISTS payslips;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_att_employee_date;`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendance;`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees;`);
  }
}



