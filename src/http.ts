import type {Cable} from "./telegraphy";

export function httpCable(
  endpoint: string | undefined,
  auth: {token: string | null}
): Cable {
  if (!endpoint) {
    throw new Error("Backend endpoint is not set");
  }

  return async (feature: string, method: string, input: unknown) => {
    if (!auth.token) {
      throw new Error("User not authenticated, cannot call cable without a token");
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${auth.token}`);

    const response = await fetch(endpoint, {
      headers,
      method: "POST",
      body: JSON.stringify({feature, method, input}),
    });

    if (!response.ok) {
      throw new Error(`Failed to call ${feature}.${method}: ${response.statusText}`);
    }

    return await response.json();
  };
}

