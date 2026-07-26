// Adaptateur ElevenLabs — API officielle (https://elevenlabs.io/docs).
// Modèle servi : eleven_turbo_v2_5 (TTS pour la narration de la chaîne Animate).
//
// Schéma : POST /v1/text-to-speech/{voice_id} (header `xi-api-key`) ->
// audio binaire (mp3), converti ici en data URI — consommable tel quel par
// le merge ffmpeg (fetch supporte les data URIs) jusqu'au jalon stockage.
//
// Clé : ELEVENLABS_API_KEY — serveur uniquement.
// ELEVENLABS_VOICE_ID optionnel (défaut : "Aria", voix de la doc officielle).
import type { ProviderAdapter } from "../types";
import { ProviderError, requireEnv } from "./http";

const DEFAULT_VOICE_ID = "9BWtsMINqrJLrRacOk9x"; // Aria

export const elevenlabsAdapter: ProviderAdapter = {
  name: "elevenlabs",
  async run(modelId, input) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
        },
        body: JSON.stringify({
          text: String(input.text ?? ""),
          model_id: modelId,
        }),
      }
    );
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 300);
      throw new ProviderError(`elevenlabs tts failed (${res.status}): ${snippet}`, res.status);
    }
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { audio: { url: `data:audio/mpeg;base64,${base64}` } };
  },
};
