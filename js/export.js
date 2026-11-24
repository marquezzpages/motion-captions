/*
 * Exportacao: monta cada quadro (video + zoom + transicao + legenda), codifica em H.264 pelo
 * codificador do celular (WebCodecs) e grava o MP4 com o audio ja cortado e os efeitos sonoros.
 */
import {
  Output, Mp4OutputFormat, BufferTarget, StreamTarget, CanvasSource, AudioBufferSource, CanvasSink,
  canEncodeAudio, getFirstEncodableVideoCodec
} from "../vendor/mediabunny.min.mjs";
import { drawFrame } from "./compose.js";
import { segAt } from "./timeline.js";

/**
 * AAC: o do aparelho quando existe; senao (iPhone antes do iOS 26) o codificador AAC em wasm.
 * Opus so em ultimo caso (alguns apps do iPhone nao tocam).
 */
let aacReady = null;
async function audioCodec() {
  const cfg = { numberOfChannels: 2, sampleRate: 48000 };
  if (await canEncodeAudio("aac", cfg)) return "aac";
  try {
    if (!aacReady) aacReady = import("../vendor/mediabunny-aac-encoder.min.mjs").then(m => m.registerAacEncoder());
    await aacReady;
    if (await canEncodeAudio("aac", cfg)) return "aac";
  } catch (e) { console.warn("aac", e); }
  return "opus";
}

/** mistura do audio final: falas cortadas + efeitos sonoros */
export async function mixAudio(S, tl, events, getSfx) {
  const sr = 48000;
  const len = Math.max(1, Math.ceil(tl.dur * sr));
  const ac = new OfflineAudioContext(2, len, sr);
  // limitador simples no fim, para os efeitos nao estourarem junto com a fala
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  const master = ac.createGain();
  master.gain.value = 0.85; // folga: o compressor deixa passar um pouco no ataque
  lim.connect(master); master.connect(ac.destination);
  const voice = ac.createGain();
  voice.gain.value = Math.pow(10, (S.voiceDb || 0) / 20);
  voice.connect(lim);
  const F = 0.006; // micro fade nos cortes (sem estalo)
  tl.segs.forEach(g => {
    const buf = S.clips[g.clip].audio;
    if (!buf) return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0, g.o);
    gn.gain.linearRampToValueAtTime(1, g.o + F);
    gn.gain.setValueAtTime(1, Math.max(g.o + F, g.o + g.len - F));
    gn.gain.linearRampToValueAtTime(0, g.o + g.len);
    src.connect(gn); gn.connect(voice);
    src.start(g.o, g.s, g.len);
  });
  for (const ev of events) {
    const b = await getSfx(ev.id);
    if (!b) continue;
    const src = ac.createBufferSource();
    src.buffer = b;
    const gn = ac.createGain();
    gn.gain.value = Math.pow(10, (ev.vol == null ? -6 : ev.vol) / 20);
    src.connect(gn); gn.connect(lim);
    if (ev.t < tl.dur) src.start(Math.max(0, ev.t));
  }
  return await ac.startRendering();
}

/**
 * Exporta. R = { tl, caps, style, pos, comp, fit, key }; S = estado; out = { width, height, fps, bitrate }
 * sink(target) = destino: null -> memoria (Blob); ou { writable } para gravar direto no arquivo.
 * onProgress(p 0..1, txt). Retorna { blob? , mime }
 */
export async function exportVideo(S, R, audioBuf, out, opts) {
  const { onProgress, writable, isCancelled } = opts || {};
  const fps = out.fps || 30;
  const W = out.width, H = out.height;
  const vcodec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9"], { width: W, height: H });
  if (!vcodec) throw new Error("Este celular não tem codificador de vídeo disponível para " + W + "×" + H + ".");
  const acodec = await audioCodec();
  const target = writable ? new StreamTarget(writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }) : new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: writable ? false : "in-memory" }), target });
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  const vsrc = new CanvasSource(canvas, { codec: vcodec, bitrate: out.bitrate || 10e6, keyFrameInterval: 2, latencyMode: "quality" });
  output.addVideoTrack(vsrc, { frameRate: fps });
  const asrc = new AudioBufferSource({ codec: acodec, bitrate: 192e3 });
  output.addAudioTrack(asrc);
  await output.start();

  const tl = R.tl;
  const N = Math.max(1, Math.round(tl.dur * fps));
  // quadros de cada trecho (um decodificador por clipe, sempre andando para frente)
  const byClip = new Map();
  const sinkOf = ci => {
    if (!byClip.has(ci)) {
      const c = S.clips[ci];
      // decodifica no tamanho que basta para cobrir a saida com zoom
      const cover = Math.max(W / c.w, H / c.h) * 1.3;
      const sw = Math.min(c.w, Math.round(c.w * Math.min(1, cover) / 2) * 2);
      byClip.set(ci, new CanvasSink(c.vt, { width: Math.max(2, sw), height: Math.max(2, Math.round(sw * c.h / c.w / 2) * 2), fit: "fill", poolSize: 2 }));
    }
    return byClip.get(ci);
  };
  let f = 0;
  for (let si = 0; si < tl.segs.length; si++) {
    const g = tl.segs[si];
    const frames = [];
    while (f < N) {
      const t = f / fps;
      const sg = segAt(tl, t);
      if (sg !== g) break;
      frames.push({ f, t, src: Math.min(g.e - 0.001, g.s + (t - g.o)) });
      f++;
    }
    if (!frames.length) continue;
    const sink = sinkOf(g.clip);
    let i = 0, last = null;
    for await (const wc of sink.canvasesAtTimestamps(frames.map(x => x.src))) {
      if (isCancelled && isCancelled()) { await output.cancel(); throw new Error("cancelado"); }
      const fr = frames[i++];
      const img = wc ? wc.canvas : last;
      if (wc) last = wc.canvas;
      drawFrame(ctx, R, fr.t, img, img ? img.width : 0, img ? img.height : 0);
      await vsrc.add(fr.t, 1 / fps);
      if (onProgress && fr.f % 5 === 0) onProgress(fr.f / N);
    }
    while (i < frames.length) { // garante o numero de quadros mesmo se faltar algum no fim do arquivo
      const fr = frames[i++];
      drawFrame(ctx, R, fr.t, last, last ? last.width : 0, last ? last.height : 0);
      await vsrc.add(fr.t, 1 / fps);
    }
  }
  vsrc.close();
  // audio em blocos de 1 s
  const sr = audioBuf.sampleRate, chans = audioBuf.numberOfChannels;
  const total = Math.min(audioBuf.length, Math.round(tl.dur * sr));
  const ac = new OfflineAudioContext(chans, 1, sr);
  for (let a = 0; a < total; a += sr) {
    const n = Math.min(sr, total - a);
    const b = ac.createBuffer(chans, n, sr);
    for (let c = 0; c < chans; c++) b.copyToChannel(audioBuf.getChannelData(c).subarray(a, a + n), c);
    await asrc.add(b);
  }
  asrc.close();
  if (onProgress) onProgress(1);
  await output.finalize();
  return writable ? {} : { blob: new Blob([target.buffer], { type: "video/mp4" }) };
}
