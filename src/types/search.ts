export type SearchResult = {
  type: "company" | "gl_account" | "gl_entry" | "bank_transaction";
  id: number;
  title: string;
  subtitle?: string;
  url?: string;
};
