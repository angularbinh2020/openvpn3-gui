export const getConfigId = (configPath: string) =>
  configPath.split("/").findLast((slg) => slg) || "";