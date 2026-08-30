import { sendJson } from "../../common/http/json.js";
import { requireQueryParam } from "../../common/validation/validation.js";
import type { BackendModule } from "../module-registry.js";

export const foundationModule: BackendModule = {
  name: "foundation",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/foundation/validate",
      handler(_request, response, { url }) {
        const value = requireQueryParam(url.searchParams, "value");

        sendJson(response, 200, {
          status: "ok",
          value,
        });
      },
    });
  },
};
