import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const testDir = mkdtempSync(path.join(tmpdir(), "agent-office-test-"));
process.env.AGENT_OFFICE_DB_PATH = path.join(testDir, "test.db");
