import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<void> {
  await apiRequest(API_ROUTES.login, { method: "POST", body: credentials });
}

export async function logout(): Promise<void> {
  await apiRequest(API_ROUTES.logout, { method: "POST" });
}
