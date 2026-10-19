// Mostra a imagem de exemplo com o filtro, fazendo na GPU a mesma conta que a tela vai fazer:
// matriz de cor primeiro, curvas (rampa de gama) depois.

const VERTICE = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() {
  uv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAGMENTO = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D imagem;
uniform sampler2D curvas;
uniform mat3 matriz;
uniform float original;
uniform float vibracao;
out vec4 cor;

float curva(float v, int canal) {
  float x = (clamp(v, 0.0, 1.0) * 255.0 + 0.5) / 256.0;
  vec4 c = texture(curvas, vec2(x, 0.5));
  return canal == 0 ? c.r : canal == 1 ? c.g : c.b;
}

void main() {
  vec3 rgb = texture(imagem, uv).rgb;
  if (original > 0.5) { cor = vec4(rgb, 1.0); return; }
  rgb = clamp(matriz * rgb, 0.0, 1.0);
  rgb = vec3(curva(rgb.r, 0), curva(rgb.g, 1), curva(rgb.b, 2));
  if (vibracao > 0.0) {
    // aproximação da vibração digital da NVIDIA: realça mais o que tem pouca cor
    float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    float s = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
    rgb = clamp(l + (rgb - l) * (1.0 + vibracao * 0.9 * (1.0 - s)), 0.0, 1.0);
  }
  cor = vec4(rgb, 1.0);
}`;

export class Previa {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('Sem WebGL2');
    this.gl = gl;
    this.prog = this.#programa(VERTICE, FRAGMENTO);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.texImagem = this.#textura();
    this.texCurvas = this.#textura();
    this.u = {
      imagem: gl.getUniformLocation(this.prog, 'imagem'),
      curvas: gl.getUniformLocation(this.prog, 'curvas'),
      matriz: gl.getUniformLocation(this.prog, 'matriz'),
      original: gl.getUniformLocation(this.prog, 'original'),
      vibracao: gl.getUniformLocation(this.prog, 'vibracao'),
    };
    this.temImagem = false;
    this.largura = 16;
    this.altura = 9;
  }

  #programa(vs, fs) {
    const gl = this.gl;
    const compilar = (tipo, fonte) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compilar(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  #textura() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  definirImagem(img) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texImagem);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    this.largura = img.naturalWidth || img.width;
    this.altura = img.naturalHeight || img.height;
    this.temImagem = true;
  }

  /** Desenha a imagem com a saída do motor. Tamanho em pixels de tela. */
  desenhar(saida, { largura, altura, original = false }) {
    if (!this.temImagem) return;
    const gl = this.gl;
    if (this.canvas.width !== largura || this.canvas.height !== altura) {
      this.canvas.width = largura;
      this.canvas.height = altura;
    }
    const lut = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      lut[i * 4] = Math.round(saida.rampa[i] * 255);
      lut[i * 4 + 1] = Math.round(saida.rampa[256 + i] * 255);
      lut[i * 4 + 2] = Math.round(saida.rampa[512 + i] * 255);
      lut[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texCurvas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);

    // a matriz do Windows é linha = entrada; a mat3 do GLSL é por coluna, então coluna j = entrada j
    const m = saida.matriz;
    const m3 = new Float32Array([m[0], m[1], m[2], m[5], m[6], m[7], m[10], m[11], m[12]]);

    gl.viewport(0, 0, largura, altura);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texImagem);
    gl.uniform1i(this.u.imagem, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texCurvas);
    gl.uniform1i(this.u.curvas, 1);
    gl.uniformMatrix3fv(this.u.matriz, false, m3);
    gl.uniform1f(this.u.original, original ? 1 : 0);
    gl.uniform1f(this.u.vibracao, saida.vibracaoPrevia || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
