export interface HoppscotchEndpoint {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  folderPath: string;
}

export interface HoppscotchTeam {
  id: string;
  name: string;
  myRole?: string;
}

export interface HoppscotchCollectionSummary {
  id: string;
  title: string;
  path?: string;
}
