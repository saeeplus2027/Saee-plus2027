declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    SAI_ADMIN_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
