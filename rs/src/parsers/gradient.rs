use crate::parsers::basic_data_types::{parse_s_rgb8, parse_straight_s_rgba8};
use nom::number::streaming::le_u8 as parse_u8;
use nom::IResult;
use swf_tree as ast;

#[allow(unused_variables)]
pub fn parse_color_stop(input: &[u8], with_alpha: bool) -> IResult<&[u8], ast::ColorStop> {
  do_parse!(
    input,
    ratio: parse_u8
      >> color:
        switch!(value!(with_alpha),
          true => call!(parse_straight_s_rgba8) |
          false => map!(parse_s_rgb8, |c| ast::StraightSRgba8 {r: c.r, g: c.g, b: c.b, a: 255})
        )
      >> (ast::ColorStop {
        ratio: ratio,
        color: color,
      })
  )
}

pub fn parse_gradient(input: &[u8], with_alpha: bool) -> IResult<&[u8], ast::Gradient> {
  let (input, flags) = parse_u8(input)?;
  let spread_id = flags >> 6;
  let color_space_id = (flags & ((1 << 6) - 1)) >> 4;
  let color_count = flags & ((1 << 4) - 1);

  let spread = match spread_id {
    0 => ast::GradientSpread::Pad,
    1 => ast::GradientSpread::Reflect,
    2 => ast::GradientSpread::Repeat,
    _ => panic!("UnexpectedSpreadId: {}", spread_id),
  };

  let color_space = match color_space_id {
    0 => ast::ColorSpace::SRgb,
    1 => ast::ColorSpace::LinearRgb,
    _ => panic!("UnexpectedColorSpaceId: {}", spread_id),
  };

  let (input, colors) = nom::multi::count(|i| parse_color_stop(i, with_alpha), color_count as usize)(input)?;

  Ok((
    input,
    ast::Gradient {
      spread,
      color_space,
      colors,
    },
  ))
}

#[allow(unused_variables)]
pub fn parse_morph_color_stop(input: &[u8], with_alpha: bool) -> IResult<&[u8], ast::MorphColorStop> {
  let (input, start) = parse_color_stop(input, with_alpha)?;
  let (input, end) = parse_color_stop(input, with_alpha)?;

  Ok((
    input,
    ast::MorphColorStop {
      ratio: start.ratio,
      color: start.color,
      morph_ratio: end.ratio,
      morph_color: end.color,
    },
  ))
}

#[allow(unused_variables)]
pub fn parse_morph_gradient(input: &[u8], with_alpha: bool) -> IResult<&[u8], ast::MorphGradient> {
  let (input, flags) = parse_u8(input)?;
  let spread_id = flags >> 6;
  let color_space_id = (flags & ((1 << 6) - 1)) >> 4;
  let color_count = flags & ((1 << 4) - 1);

  let spread = match spread_id {
    0 => ast::GradientSpread::Pad,
    1 => ast::GradientSpread::Reflect,
    2 => ast::GradientSpread::Repeat,
    _ => panic!("UnexpectedSpreadId: {}", spread_id),
  };

  let color_space = match color_space_id {
    0 => ast::ColorSpace::SRgb,
    1 => ast::ColorSpace::LinearRgb,
    _ => panic!("UnexpectedColorSpaceId: {}", spread_id),
  };

  let (input, colors) = nom::multi::count(|i| parse_morph_color_stop(i, with_alpha), color_count as usize)(input)?;

  Ok((
    input,
    ast::MorphGradient {
      spread,
      color_space,
      colors,
    },
  ))
}
