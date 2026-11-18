import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache yet: every page here is dynamic or client-rendered.
// Add the R2 incremental cache when static/ISR pages (e.g. the landing page) need it.
export default defineCloudflareConfig();
