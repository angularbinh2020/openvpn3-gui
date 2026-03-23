// src/shared/utils.ts

/**
 * Tạo config ID từ config path — phải khớp với logic trong store.rs
 */
export function getConfigId(configPath: string): string {
  return configPath
    .replace(/[/\\.  ]/g, '_')
    .replace(/^_+|_+$/g, '');
}
