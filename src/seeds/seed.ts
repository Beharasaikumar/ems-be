 import AppDataSource from '../ormconfig';
import { Employee } from '../entities/Employee';
import { Attendance } from '../entities/Attendance';
import * as path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

type SeedSchema = {
  employees?: Partial<Employee>[];
  attendance?: { employeeId: string; date: string; status: string }[];
};

async function loadSeedFile(): Promise<SeedSchema> {
  // support JSON or JS export: check file existence
  const jsonPath = path.join(__dirname, 'data.json');
//   const jsPath = path.join(__dirname, 'data.js'); // or data.ts compiled
  if (await fileExists(jsonPath)) {
    const raw = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(raw);
  }
//   if (await fileExists(jsPath)) {
//     // require() JS file (CommonJS). Ensure compiled if using ts-node.
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     const loaded = require(jsPath);
//     return loaded.default ?? loaded;
//   }
  throw new Error('No seed file found at src/seeds/data.json');
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function runSeed() {
  await AppDataSource.initialize();
  console.log('DataSource initialized for seeding');

  const seed = await loadSeedFile();
  const empRepo = AppDataSource.getRepository(Employee);
  const attRepo = AppDataSource.getRepository(Attendance);

  // Employees: insert if not exists
  const employees = seed.employees ?? [];
  let empInserted = 0;
  for (const e of employees) {
    if (!e.id) {
      // create ID if not provided
      // caution: keep unique format if front end expects certain ids
      // we use uuid here if none provided
      // better: prefer provided ids from your example file
      (e as any).id = `EMP-${uuidv4().slice(0,8)}`;
    }
    const existing = await empRepo.findOneBy({ id: (e as any).id });
    if (existing) {
      // optionally update existing record if you prefer:
      // await empRepo.update({ id: e.id }, e);
      continue;
    }
    const ent = empRepo.create(e as Employee);
    await empRepo.save(ent);
    empInserted++;
  }

  // Attendance: upsert by employeeId+date
  const attendance = seed.attendance ?? [];
  let attInserted = 0;
  for (const a of attendance) {
    if (!a.employeeId || !a.date) continue;
    const existing = await attRepo.findOne({ where: { employeeId: a.employeeId, date: a.date } as any });
    if (existing) {
      // update status if different
      if (existing.status !== a.status) {
        existing.status = a.status;
        await attRepo.save(existing);
      }
      continue;
    }
    const ent = attRepo.create({ id: uuidv4(), employeeId: a.employeeId, date: a.date, status: a.status });
    await attRepo.save(ent);
    attInserted++;
  }

  console.log(`Seeding complete. Employees inserted: ${empInserted}, Attendance inserted: ${attInserted}`);
  await AppDataSource.destroy();
  process.exit(0);
}

if (require.main === module) {
  runSeed().catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
  });
}
