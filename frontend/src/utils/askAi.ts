import { Platform, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";

export type AiProvider = "claude" | "chatgpt";

const PREFILL_BASE: Record<AiProvider, string> = {
  claude: "https://claude.ai/new?q=",
  chatgpt: "https://chatgpt.com/?q=",
};

const HOMEPAGE: Record<AiProvider, string> = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
};

const MAX_URL_LENGTH = 7500;

/**
 * Builds the prefilled AI URL. encodeURIComponent turns "#" into %23 so the
 * prompt is not truncated at the URL fragment.
 */
export function buildPromptUrl(provider: AiProvider, text: string): string {
  return PREFILL_BASE[provider] + encodeURIComponent(text);
}

function openUrl(url: string) {
  if (Platform.OS === "web") {
    // No identity is carried; opens the user's own session or the login page.
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url);
  }
}

/**
 * Opens the prompt in the chosen AI provider.
 * - If the encoded URL is within the length guard, opens the prefilled link.
 * - Otherwise copies the prompt to the clipboard, opens the bare homepage and
 *   notifies via onToast.
 */
export async function openAskAi(
  provider: AiProvider,
  promptText: string,
  onToast?: (msg: string) => void,
): Promise<void> {
  const url = buildPromptUrl(provider, promptText);
  if (url.length > MAX_URL_LENGTH) {
    await Clipboard.setStringAsync(promptText);
    openUrl(HOMEPAGE[provider]);
    onToast?.("Prompt copiato — incollalo con Ctrl+V");
    return;
  }
  openUrl(url);
}
