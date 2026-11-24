/*
 * Leitura dos videos do celular (Mediabunny + WebCodecs): informacoes, audio e miniatura.
 */
import { Input, BlobSource, ALL_FORMATS, AudioBufferSink, CanvasSink } from "../vendor/mediabunny.min.mjs";

/** abre um arquivo de video e le o basico */
export async function openClip(file) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error("Esse arquivo não tem vídeo.");
  if (!(await vt.canDecode())) throw new Error("O celular não consegue abrir o formato desse vídeo (" + (vt.codec || "?") + ").");
  const at = await input.getPrimaryAudioTrack();
  const dur = await input.computeDuration();
  let fps = 30;
  try { const st = await vt.computePacketStats(60); if (st.averagePacketRate > 1) fps = st.averagePacketRate; } catch (e) { /* ok */ }
  return {
    input, vt, at, dur, fps,
    w: vt.displayWidth, h: vt.displayHeight,
    hasAudio: !!(at && await at.canDecode())
  };
}

/** miniatura (dataURL) */
export async function thumb(clip, t) {
  const sink = new CanvasSink(clip.vt, { width: 160, fit: "contain" });
  const wc = await sink.getCanvas(Math.min(t == null ? 0.5 : t, Math.max(0, clip.dur - 0.1)));
  if (!wc) return "";
  const c = wc.canvas;
  if (c.toDataURL) return c.toDataURL("image/jpeg", 0.7);
  const blob = await c.convertToBlob({ type: "image/jpeg", quality: 0.7 });
  return URL.createObjectURL(blob);
}

/**
 * Audio inteiro do clipe como AudioBuffer (taxa original, ate 2 canais).
 * Sem audio: silencio do tamanho do video.
 */
export async function decodeAudio(clip, onProgress) {
  const ac = new OfflineAudioContext(2, 2, 48000);
  if (!clip.hasAudio) return ac.createBuffer(2, Math.max(1, Math.ceil(clip.dur * 48000)), 48000);
  const sink = new AudioBufferSink(clip.at);
  const parts = [];
  let sr = 48000, len = 0, chans = 1;
  for await (const wb of sink.buffers()) {
    const b = wb.buffer;
    sr = b.sampleRate; chans = Math.max(chans, Math.min(2, b.numberOfChannels));
    parts.push({ b, ts: wb.timestamp });
    len = Math.max(len, Math.round((wb.timestamp + b.duration) * sr));
    if (onProgress) onProgress(Math.min(1, (wb.timestamp + b.duration) / clip.dur));
  }
  len = Math.max(len, Math.ceil(clip.dur * sr));
  const out = ac.createBuffer(chans, Math.max(1, len), sr);
  for (let c = 0; c < chans; c++) {
    const dst = out.getChannelData(c);
    parts.forEach(({ b, ts }) => {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
      const o = Math.max(0, Math.round(ts * sr));
      dst.set(src.subarray(0, Math.max(0, Math.min(src.length, dst.length - o))), o);
    });
  }
  return out;
}

/** AudioBuffer -> Float32Array 16 kHz mono (para o Whisper e o corte) */
export async function to16k(buf) {
  const len = Math.max(1, Math.ceil(buf.duration * 16000));
  const ac = new OfflineAudioContext(1, len, 16000);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start();
  const r = await ac.startRendering();
  return r.getChannelData(0);
}

/** arquivo de som do celular -> AudioBuffer */
export async function decodeSoundFile(file) {
  const ab = await file.arrayBuffer();
  const ac = new OfflineAudioContext(2, 2, 48000);
  return await ac.decodeAudioData(ab);
}
