// Classic Perlin noise (2D) with a seedable permutation table, plus fBm helper.
export class Noise2D {
  constructor(seed = 1337) {
    let s = (seed >>> 0) || 1;
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(t, a, b) { return a + t * (b - a); }
  static grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = Noise2D.fade(x), v = Noise2D.fade(y);
    const p = this.perm;
    const aa = p[X + p[Y]], ab = p[X + p[Y + 1]];
    const ba = p[X + 1 + p[Y]], bb = p[X + 1 + p[Y + 1]];
    const res = Noise2D.lerp(v,
      Noise2D.lerp(u, Noise2D.grad(aa, x, y), Noise2D.grad(ba, x - 1, y)),
      Noise2D.lerp(u, Noise2D.grad(ab, x, y - 1), Noise2D.grad(bb, x - 1, y - 1)));
    return res / 2;
  }

  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
