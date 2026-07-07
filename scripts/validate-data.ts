import { ZodError } from "zod";

import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources
} from "./data-io";
import { validateDataBundle } from "../lib/validation";

async function validateData(): Promise<void> {
  const [items, people, issues, sources, collectionState] = await Promise.all([
    readItems(),
    readPeople(),
    readIssues(),
    readSources(),
    readCollectionState()
  ]);

  validateDataBundle({ items, people, issues, sources, collectionState });

  console.log(
    `Data valid: ${items.length} items, ${issues.length} issues, ${people.length} people, ${sources.length} sources`
  );
}

validateData().catch((error: unknown) => {
  if (error instanceof ZodError) {
    console.error(error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
