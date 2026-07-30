export interface ResolvedAuthor {
  uid: string | null;
  displayName: string;
  studentCode?: string;
  universityCode?: string;
  attributionStatus: "VERIFIED" | "LEGACY_MATCH" | "UNKNOWN";
}
