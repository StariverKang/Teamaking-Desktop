import { fileURLToPath } from "node:url";

export const pdfStandardFontDataUrl = fileURLToPath(import.meta.resolve("pdfjs-dist/standard_fonts/"));

let pdfjsPromise = null;

class MinimalDOMMatrix {
  constructor(init) {
    const values = Array.isArray(init) || ArrayBuffer.isView(init) ? [...init] : [];
    this.a = Number(values[0] ?? 1);
    this.b = Number(values[1] ?? 0);
    this.c = Number(values[2] ?? 0);
    this.d = Number(values[3] ?? 1);
    this.e = Number(values[4] ?? 0);
    this.f = Number(values[5] ?? 0);
    this.is2D = true;
    this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  multiplySelf() {
    return this;
  }

  preMultiplySelf() {
    return this;
  }

  translateSelf(x = 0, y = 0) {
    this.e += Number(x) || 0;
    this.f += Number(y) || 0;
    this.isIdentity = false;
    return this;
  }

  translate(x = 0, y = 0) {
    return new MinimalDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).translateSelf(x, y);
  }

  scaleSelf(scaleX = 1, scaleY = scaleX) {
    this.a *= Number(scaleX) || 1;
    this.d *= Number(scaleY) || 1;
    this.isIdentity = false;
    return this;
  }

  scale(scaleX = 1, scaleY = scaleX) {
    return new MinimalDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).scaleSelf(scaleX, scaleY);
  }

  invertSelf() {
    return this;
  }

  inverse() {
    return new MinimalDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]);
  }
}

class MinimalImageData {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = Number(widthOrHeight) || 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = Number(widthOrHeight) || 0;
      this.height = Number(height) || 0;
    }
  }
}

class MinimalPath2D {
  addPath() {}
}

function installPdfjsNodeFallbacks() {
  globalThis.DOMMatrix ??= MinimalDOMMatrix;
  globalThis.ImageData ??= MinimalImageData;
  globalThis.Path2D ??= MinimalPath2D;
}

export async function loadPdfjs() {
  installPdfjsNodeFallbacks();
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}
