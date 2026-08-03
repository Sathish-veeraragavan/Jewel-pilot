import os
from PIL import Image, ImageDraw, ImageFilter
import math

def create_outline_frame(filename, shape_type, size=(800, 240), stroke_width=6, stroke_color="#1E1E1E"):
    scale = 4
    w, h = size[0] * scale, size[1] * scale
    sw = stroke_width * scale
    
    # Completely transparent image with NO fill inside
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    pad = 20 * scale
    
    if shape_type == "classic_scroll":
        # Rounded box with scroll ears
        rad = 30 * scale
        draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=rad, outline=stroke_color, width=sw)
        # Decorative top/bottom curls
        cx = w / 2.0
        draw.arc([cx - 40*scale, pad - 25*scale, cx + 40*scale, pad + 25*scale], start=180, end=360, fill=stroke_color, width=sw)
        draw.arc([cx - 40*scale, h - pad - 25*scale, cx + 40*scale, h - pad + 25*scale], start=0, end=180, fill=stroke_color, width=sw)

    elif shape_type == "scalloped_notch":
        # Inset corner notch frame
        notch = 40 * scale
        pts = [
            (pad + notch, pad),
            (w - pad - notch, pad),
            (w - pad - notch, pad + notch),
            (w - pad, pad + notch),
            (w - pad, h - pad - notch),
            (w - pad - notch, h - pad - notch),
            (w - pad - notch, h - pad),
            (pad + notch, h - pad),
            (pad + notch, h - pad - notch),
            (pad, h - pad - notch),
            (pad, pad + notch),
            (pad + notch, pad + notch),
            (pad + notch, pad)
        ]
        draw.line(pts, fill=stroke_color, width=sw)

    elif shape_type == "filigree_cartouche":
        # Oval cartouche outline
        draw.ellipse([pad, pad, w - pad, h - pad], outline=stroke_color, width=sw)
        # Inner parallel thin line
        ipad = pad + 15 * scale
        draw.ellipse([ipad, ipad, w - ipad, h - ipad], outline=stroke_color, width=int(sw/2))

    elif shape_type == "diamond_notch":
        # Pointy diamond center top/bottom
        cx, cy = w / 2.0, h / 2.0
        ds = 20 * scale
        pts = [
            (pad, pad),
            (cx - ds, pad),
            (cx, pad - ds),
            (cx + ds, pad),
            (w - pad, pad),
            (w - pad, h - pad),
            (cx + ds, h - pad),
            (cx, h - pad + ds),
            (cx - ds, h - pad),
            (pad, h - pad),
            (pad, pad)
        ]
        draw.line(pts, fill=stroke_color, width=sw)

    elif shape_type == "curly_flourish":
        # Rounded rect with curly corners
        rad = 40 * scale
        draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=rad, outline=stroke_color, width=sw)
        # Corner spiral loops
        for px, py, start_a, end_a in [
            (pad, pad, 90, 270),
            (w - pad, pad, 270, 90),
            (w - pad, h - pad, 0, 180),
            (pad, h - pad, 180, 360)
        ]:
            draw.arc([px - 20*scale, py - 20*scale, px + 20*scale, py + 20*scale], start=start_a, end=end_a, fill=stroke_color, width=sw)

    elif shape_type == "double_line_ornate":
        # Outer thick, inner thin line
        draw.rectangle([pad, pad, w - pad, h - pad], outline=stroke_color, width=sw)
        ipad = pad + 12 * scale
        draw.rectangle([ipad, ipad, w - ipad, h - ipad], outline=stroke_color, width=int(sw/2))

    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created bg-less outline frame: {filename}")

def main():
    out_dir = "/Users/sathishveeraragavan/Downloads/Jewellery webapplication for the videos/public/presets"
    os.makedirs(out_dir, exist_ok=True)
    
    shapes = [
        "classic_scroll",
        "scalloped_notch",
        "filigree_cartouche",
        "diamond_notch",
        "curly_flourish",
        "double_line_ornate"
    ]
    
    for shape in shapes:
        create_outline_frame(f"{out_dir}/frame_{shape}.png", shape_type=shape)

if __name__ == "__main__":
    main()
