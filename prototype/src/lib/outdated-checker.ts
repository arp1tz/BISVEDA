/**
 * BISVEDA Layer 2 — Outdated Reference & Superseded Standards Checker (V7 §7.10 & V8 §7.10)
 * Scans queries and input references for withdrawn or superseded Indian Standards.
 * Immediately warns users and transparently links to the operative gazetted revision.
 */

import type { OutdatedReferenceInfo } from "./types";

interface SupersededMapping {
  originalPattern: RegExp;
  originalLabel: string;
  currentStandard: string;
  status: "SUPERSEDED" | "WITHDRAWN" | "AMENDED";
  notice: string;
}

const HISTORICAL_SUPERSEDED_STANDARDS: SupersededMapping[] = [
  {
    originalPattern: /\bIS\s*4151\s*(?::\s*(?:1974|1982|1993))?\b/i,
    originalLabel: "IS 4151:1993 (or earlier edition)",
    currentStandard: "IS 4151:2020",
    status: "SUPERSEDED",
    notice: "IS 4151:1993 was formally superseded by IS 4151:2020 (Fourth Revision) with enhanced impact absorption drop-energy criteria, retention micro-slip test limits, and mandatory chin strap dynamic deflection.",
  },
  {
    originalPattern: /\bIS\s*2347\s*(?::\s*(?:1987|1995|2006))?\b/i,
    originalLabel: "IS 2347:2006 (or earlier edition)",
    currentStandard: "IS 2347:2017",
    status: "SUPERSEDED",
    notice: "IS 2347:2006 was superseded by IS 2347:2017 (Fifth Revision) for Domestic Pressure Cookers, establishing mandatory fusible plug safety relief temperature thresholds and thermal hydrostatic rupture safety.",
  },
  {
    originalPattern: /\bIS\s*1293\s*(?::\s*(?:1988|2005))?\b/i,
    originalLabel: "IS 1293:2005",
    currentStandard: "IS 1293:2019",
    status: "SUPERSEDED",
    notice: "IS 1293:2005 was superseded by IS 1293:2019 (Fifth Revision) for Plugs and Socket-Outlets, mandating internal child-safety shutters and tightened pin-withdrawal pull force constraints.",
  },
  {
    originalPattern: /\bIS\s*9873\s*(?:\(?Part\s*1\)?)?\s*(?::\s*2012)?\b/i,
    originalLabel: "IS 9873 (Part 1):2012",
    currentStandard: "IS 9873 (Part 1):2019",
    status: "SUPERSEDED",
    notice: "IS 9873 (Part 1):2012 was superseded by IS 9873 (Part 1):2019 for Safety of Toys, mandating strict projectile tip kinetic energy constraints and small parts choking hazard limits.",
  },
  {
    originalPattern: /\bIS\s*14543\s*(?::\s*(?:1998|2004|2016))?\b/i,
    originalLabel: "IS 14543:2004",
    currentStandard: "IS 14543:2024",
    status: "SUPERSEDED",
    notice: "IS 14543:2004 was superseded by IS 14543:2024 for Packaged Drinking Water, establishing updated microbiological, pesticide residue, and chemical quality requirements.",
  },
];

/**
 * Checks if a query or document citation refers to an outdated / superseded standard.
 */
export function checkOutdatedReference(query: string): OutdatedReferenceInfo | null {
  for (const item of HISTORICAL_SUPERSEDED_STANDARDS) {
    // Check if query explicitly has an older year or if user is querying the historical code
    if (item.originalPattern.test(query)) {
      // Check if user specifically queried an outdated year (e.g. 1993, 2006, 2005)
      const hasOldYear = /:(?:19\d{2}|200\d|201[0-5])\b/.test(query);
      if (hasOldYear) {
        return {
          queriedStandard: query.match(item.originalPattern)?.[0] || item.originalLabel,
          currentStandard: item.currentStandard,
          status: item.status,
          enforcementNotice: item.notice,
        };
      }
    }
  }
  return null;
}
