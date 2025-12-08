import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthMigration1700000000001 implements MigrationInterface {
  name = 'AuthMigration1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR UNIQUE NOT NULL,
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        role VARCHAR DEFAULT 'employee',
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        token VARCHAR NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE password_reset_tokens`);
    await queryRunner.query(`DROP TABLE users`);
  }
}
