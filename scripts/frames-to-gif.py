"""Arma un GIF con los cuadros que captura readme-gifs.mjs, con la duración real entre cuadros.

Uso: python scripts/frames-to-gif.py frames.json salida.gif
Una sola paleta para todo el clip (los diagramas usan pocos colores) y cuadros parciales: el GIF pesa poco.
"""
import json
import sys

from PIL import Image

frames_file, out = sys.argv[1], sys.argv[2]
frames = json.load(open(frames_file, encoding='utf-8'))
images = [Image.open(f['file']).convert('RGB') for f in frames]

# Paleta común a partir de una muestra de cuadros repartidos en el clip.
sample = images[:: max(1, len(images) // 12)]
strip = Image.new('RGB', (sample[0].width, sample[0].height * len(sample)))
for i, im in enumerate(sample):
    strip.paste(im, (0, i * im.height))
palette = strip.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
quantized = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]

times = [f['t'] for f in frames]
durations = [max(20, b - a) for a, b in zip(times, times[1:])] + [1800]  # el último cuadro se queda un momento

quantized[0].save(
    out,
    save_all=True,
    append_images=quantized[1:],
    duration=durations,
    loop=0,
    optimize=True,
    disposal=1,
)
import os
print(f'{out}: {len(images)} frames, {sum(durations) / 1000:.1f}s, {os.path.getsize(out) / 1e6:.2f} MB')
