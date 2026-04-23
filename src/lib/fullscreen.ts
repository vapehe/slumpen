import { getCurrentWindow } from "@tauri-apps/api/window";

export async function isFullscreen(): Promise<boolean> {
  try {
    return await getCurrentWindow().isFullscreen();
  } catch {
    return false;
  }
}

export async function toggleFullscreen(): Promise<boolean> {
  const win = getCurrentWindow();
  const current = await win.isFullscreen();
  await win.setFullscreen(!current);
  return !current;
}

export async function setFullscreen(on: boolean): Promise<void> {
  await getCurrentWindow().setFullscreen(on);
}
