import {Incident} from "incident";
import {Float16, Sint16, SintSize, Uint16, Uint8, UintSize} from "semantic-types";
import {LanguageCode, Rect, StraightSRgba8, shapes, text} from "swf-tree";
import {BitStream, ByteStream} from "../stream";
import {parseRect, parseSRgb8, parseStraightSRgba8} from "./basic-data-types";
import {parseGlyph} from "./shapes";

export function parseGridFittingBits(bitStream: BitStream): text.GridFitting {
  const code: UintSize = bitStream.readUint32Bits(2);
  switch (code) {
    case 0:
      return text.GridFitting.None;
    case 1:
      return text.GridFitting.Pixel;
    case 2:
      return text.GridFitting.SubPixel;
    default:
      throw new Incident("UnreachableCode");
  }
}

export function parseLanguageCode(byteStream: ByteStream): LanguageCode {
  const code: Uint8 = byteStream.readUint8();
  switch (code) {
    case 0:
      return LanguageCode.Auto;
    case 1:
      return LanguageCode.Latin;
    case 2:
      return LanguageCode.Japanese;
    case 3:
      return LanguageCode.Korean;
    case 4:
      return LanguageCode.SimplifiedChinese;
    case 5:
      return LanguageCode.TraditionalChinese;
    default:
      throw new Incident("UnreachableCode");
  }
}

export function parseTextRendererBits(bitStream: BitStream): text.TextRenderer {
  const code: UintSize = bitStream.readUint32Bits(2);
  switch (code) {
    case 0:
      return text.TextRenderer.Normal;
    case 1:
      return text.TextRenderer.Advanced;
    default:
      throw new Incident("UnreachableCode");
  }
}

export function parseTextRecordString(
  byteStream: ByteStream,
  colorAlpha: boolean,
  glyphBits: UintSize,
  advanceBits: UintSize
): text.TextRecord[] {
  const result: text.TextRecord[] = [];
  while (byteStream.peekUint8() !== 0) {
    result.push(parseTextRecord(byteStream, colorAlpha, glyphBits, advanceBits));
  }
  byteStream.skip(1); // End of records
  return result;
}

export function parseTextRecord(
  byteStream: ByteStream,
  colorAlpha: boolean,
  glyphBits: UintSize,
  advanceBits: UintSize
): text.TextRecord {
  const flags: Uint8 = byteStream.readUint8();
  const hasFont: boolean = (flags & (1 << 3)) > 0;
  const hasColor: boolean = (flags & (1 << 2)) > 0;
  const hasOffsetX: boolean = (flags & (1 << 1)) > 0;
  const hasOffsetY: boolean = (flags & (1 << 0)) > 0;
  const fontId: Uint16 | undefined = hasFont ? byteStream.readUint16LE() : undefined;
  let color: StraightSRgba8 | undefined = undefined;
  if (hasColor) {
    color = colorAlpha ? parseStraightSRgba8(byteStream) : {...parseSRgb8(byteStream), a: 255};
  }
  const offsetX: Sint16 = hasOffsetX ? byteStream.readSint16LE() : 0;
  const offsetY: Sint16 = hasOffsetY ? byteStream.readSint16LE() : 0;
  const fontSize: Uint16 | undefined = hasFont ? byteStream.readUint16LE() : undefined;
  const entryCount: UintSize = byteStream.readUint8();

  const bitStream = byteStream.asBitStream();
  const entries: text.GlyphEntry[] = [];
  for (let i: UintSize = 0; i < entryCount; i++) {
    const index: UintSize = bitStream.readUint32Bits(glyphBits);
    const advance: SintSize = bitStream.readSint32Bits(advanceBits);
    entries.push({index, advance});
  }
  return {fontId, color, offsetX, offsetY, fontSize, entries};
}

export function parseCsmTableHintBits(bitStream: BitStream): text.CsmTableHint {
  switch (bitStream.readUint16Bits(2)) {
    case 0:
      return text.CsmTableHint.Thin;
    case 1:
      return text.CsmTableHint.Medium;
    case 2:
      return text.CsmTableHint.Thick;
    default:
      throw new Incident("UnreachableCode");
  }
}

export function parseFontAlignmentZone(byteStream: ByteStream): text.FontAlignmentZone {
  const zoneDataCount: UintSize = byteStream.readUint8();
  // TODO: Assert zoneDataCount === 2
  const data: text.FontAlignmentZoneData[] = [];
  for (let i: number = 0; i < zoneDataCount; i++) {
    data.push(parseFontAlignmentZoneData(byteStream));
  }
  const flags: Uint8 = byteStream.readUint8();
  const hasY: boolean = (flags & (1 << 1)) > 0;
  const hasX: boolean = (flags & (1 << 0)) > 0;
  return {data, hasX, hasY};
}

export function parseFontAlignmentZoneData(byteStream: ByteStream): text.FontAlignmentZoneData {
  const origin: Float16 = byteStream.readFloat16BE();
  const size: Float16 = byteStream.readFloat16BE();
  return {origin, size};
}

export function parseOffsetGlyphs(byteStream: ByteStream, glyphCount: UintSize, useWideOffset: boolean): shapes.Glyph[] {
  const startPos: UintSize = byteStream.bytePos;
  const offsets: UintSize[] = new Array(glyphCount + 1);
  for (let i: number = 0; i < offsets.length; i++) {
    offsets[i] = useWideOffset ? byteStream.readUint32LE() : byteStream.readUint16LE();
  }
  const result: shapes.Glyph[] = [];
  for (let i: number = 1; i < offsets.length; i++) {
    const length: UintSize = offsets[i] - (byteStream.bytePos - startPos);
    result.push(parseGlyph(byteStream.take(length)))
  }
  return result;
}

export function parseFontLayout(byteStream: ByteStream, glyphCount: UintSize): text.FontLayout {
  const ascent: Uint16 = byteStream.readUint16LE();
  const descent: Uint16 = byteStream.readUint16LE();
  const leading: Uint16 = byteStream.readUint16LE();
  const advances: Uint16[] = new Array(glyphCount);
  for (let i: number = 0; i < advances.length; i++) {
    advances[i] = byteStream.readUint16LE();
  }
  const bounds: Rect[] = new Array(glyphCount);
  for (let i: number = 0; i < bounds.length; i++) {
    bounds[i] = parseRect(byteStream);
  }
  const kerning: text.KerningRecord[] = new Array(byteStream.readUint16LE());
  for (let i: number = 0; i < kerning.length; i++) {
    kerning[i] = parseKerningRecord(byteStream);
  }
  return {ascent, descent, leading, advances, bounds, kerning};
}

export function parseKerningRecord(byteStream: ByteStream): text.KerningRecord {
  const left: Uint16 = byteStream.readUint16LE();
  const right: Uint16 = byteStream.readUint16LE();
  const adjustment: Sint16 = byteStream.readSint16LE();
  return {left, right, adjustment};
}
