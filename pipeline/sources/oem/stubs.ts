import { KNOWN_OEMS } from "./brands";
import type { Source } from "../types";

// OEMs that already have a fully-wired adapter; everything else is registered as
// a stub so the catalogue is complete and new adapters are a drop-in replacement.
const IMPLEMENTED = new Set(["Toyota", "Honda", "Ford"]);

/**
 * A stub source documents an OEM whose locator adapter is not yet wired. It
 * implements the Source interface (returning no records) so it shows up in the
 * registry and report. To activate one, replace it with createOemSource({...}).
 */
function makeStub(oem: string): Source {
  const name = `oem:${oem.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return {
    name,
    kind: "oem",
    oem,
    status: "stub",
    async fetch() {
      return [];
    },
  };
}

export const oemStubSources: Source[] = KNOWN_OEMS.filter((o) => !IMPLEMENTED.has(o)).map(makeStub);
