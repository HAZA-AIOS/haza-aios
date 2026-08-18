import type { ApiRouter } from "../routes/router.js";

export type BackendModule = {
  name: string;
  register: (router: ApiRouter) => void;
};

export function registerModules(router: ApiRouter, modules: BackendModule[]) {
  for (const moduleDefinition of modules) {
    moduleDefinition.register(router);
  }
}
