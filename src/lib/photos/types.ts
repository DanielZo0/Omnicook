export type PhotoKind = 'source' | 'lookup' | 'generated' | 'user';
export type PhotoMetadata = {
  kind: PhotoKind | null;
  status: 'pending' | 'ready' | 'unavailable';
  token?: string;
  startedAt?: string;
  attempts?: number;
  retryAfter?: string;
  credit?: string;
  creditUrl?: string;
  license?: string;
  licenseUrl?: string;
};
export type PhotoRecipe = {
  title: string;
  ingredients: {name: string}[];
  steps: {instruction: string}[];
};
export type StoredPhoto = {data: Buffer; metadata: PhotoMetadata};
