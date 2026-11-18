export interface ApiErrorBody {
  code: string;
  message: string;
}

export type ApiEnvelope<TData> = { data: TData } | { error: ApiErrorBody };
