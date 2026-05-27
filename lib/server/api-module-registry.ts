import { ApiContext, ApiModuleHandler } from "@/lib/server/api-context";

export type ApiModuleRegistration = {
  name: string;
  matches: (context: ApiContext) => boolean;
  handler: ApiModuleHandler;
};

export type ApiModuleRegistry = {
  resolve: (context: ApiContext) => ApiModuleHandler | null;
};

export function createApiModuleRegistry(modules: ApiModuleRegistration[]): ApiModuleRegistry {
  return {
    resolve(context) {
      return modules.find((module) => module.matches(context))?.handler ?? null;
    }
  };
}
