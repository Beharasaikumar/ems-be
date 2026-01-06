import { MigrationInterface, QueryRunner } from "typeorm";

export class BillMigration1700000000002 implements MigrationInterface {
  name = 'BillMigration1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        category VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'Pending',
        "billDate" DATE NOT NULL,
        "fileName" VARCHAR,
        "fileData" TEXT,
        "uploadedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bills`);
  }
}
