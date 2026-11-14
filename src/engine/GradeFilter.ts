import { Filter, GlProgram, UniformGroup } from 'pixi.js';
import type { ColorAdjustment } from '../model/types';
import { resolveAdjustment } from './grade';

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uBasic;
uniform vec4 uTonal;
uniform float uFade;
void main() {
  vec4 pixel = texture(uTexture, vTextureCoord);
  vec3 c = pixel.a > 0.0 ? pixel.rgb / pixel.a : vec3(0.0);
  c = (c * uBasic.x - 0.5) * uBasic.y + 0.5;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float tonal = uTonal.x * 0.35 * smoothstep(0.4, 1.0, lum)
    + uTonal.y * 0.25 * (1.0 - smoothstep(0.0, 0.6, lum))
    - uTonal.z * 0.35 * (1.0 - smoothstep(0.0, 0.55, lum));
  c += tonal;
  c = c * (1.0 - uFade * 0.16) + uFade * 0.16;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float chroma = clamp(max(max(c.r,c.g),c.b) - min(min(c.r,c.g),c.b), 0.0, 1.0);
  float saturation = max(0.0, uBasic.z * (1.0 + uTonal.w * (1.0 - chroma)));
  c = mix(vec3(luma), c, saturation);
  c *= vec3(1.0 + uBasic.w, 1.0, 1.0 - uBasic.w);
  finalColor = vec4(clamp(c, 0.0, 1.0) * pixel.a, pixel.a);
}`;

/** One cached WebGL pass; keyframing changes uniforms, never textures or shader programs. */
export class GradeFilter extends Filter {
  private tones: UniformGroup;
  constructor() {
    const tones = new UniformGroup({
      uBasic: { value: new Float32Array([1, 1, 1, 0]), type: 'vec4<f32>' },
      uTonal: { value: new Float32Array(4), type: 'vec4<f32>' },
      uFade: { value: 0, type: 'f32' },
    });
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'little-moments-grade' }),
      resources: { gradeUniforms: tones },
    });
    this.tones = tones;
    this.padding = 0;
  }
  setTone(value: ColorAdjustment) {
    const p = resolveAdjustment(value),
      u = this.tones.uniforms as { uBasic: Float32Array; uTonal: Float32Array; uFade: number };
    u.uBasic[0] = p.brightness * 2 ** p.exposure;
    u.uBasic[1] = p.contrast;
    u.uBasic[2] = p.saturation;
    u.uBasic[3] = p.temperature * 0.18;
    u.uTonal[0] = p.highlights;
    u.uTonal[1] = p.shadows;
    u.uTonal[2] = p.blacks;
    u.uTonal[3] = p.vibrance;
    u.uFade = p.fade;
    this.tones.update();
  }
}
