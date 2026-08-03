import os
from PIL import Image, ImageDraw, ImageFilter
import math

def create_circle_gold_border(filename, bg_color, border_color="#D4AF37", size=(512, 512), border_width=12):
    # Create high-res image (1024x1024) for super crisp edges, then downscale
    scale = 2
    w, h = size[0] * scale, size[1] * scale
    bw = border_width * scale
    
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw circle filled with bg_color, and gold border
    padding = 20 * scale
    draw.ellipse(
        [padding, padding, w - padding, h - padding],
        fill=bg_color,
        outline=border_color,
        width=bw
    )
    
    # Optional gold inner ring
    draw.ellipse(
        [padding + bw + 15, padding + bw + 15, w - padding - bw - 15, h - padding - bw - 15],
        outline=border_color,
        width=int(bw/3)
    )
    
    # Downscale for anti-aliased high-quality edge
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created shape: {filename}")

def create_rect_gold_border(filename, bg_color, border_color="#D4AF37", size=(800, 200), border_width=8, radius=40):
    scale = 2
    w, h = size[0] * scale, size[1] * scale
    bw = border_width * scale
    rad = radius * scale
    
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = 10 * scale
    draw.rounded_rectangle(
        [padding, padding, w - padding, h - padding],
        radius=rad,
        fill=bg_color,
        outline=border_color,
        width=bw
    )
    
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created shape: {filename}")

def create_gold_purity_banner(filename, size=(800, 200), border_color="#1E1E1E", bg_color="#D4AF37", border_width=4, radius=30):
    # A solid gold banner card
    scale = 2
    w, h = size[0] * scale, size[1] * scale
    bw = border_width * scale
    rad = radius * scale
    
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = 10 * scale
    # Gold background
    draw.rounded_rectangle(
        [padding, padding, w - padding, h - padding],
        radius=rad,
        fill=bg_color
    )
    
    # Inner border line
    inner_pad = padding + 12
    draw.rounded_rectangle(
        [inner_pad, inner_pad, w - inner_pad, h - inner_pad],
        radius=rad - 12,
        outline=border_color,
        width=bw
    )
    
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created gold purity banner: {filename}")

def create_elegant_gold_divider(filename, size=(600, 50), color="#D4AF37"):
    scale = 2
    w, h = size[0] * scale, size[1] * scale
    
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Main line
    line_y = h / 2.0
    draw.line([(20 * scale, line_y), (w - 20 * scale, line_y)], fill=color, width=4 * scale)
    
    # Center diamond
    cx, cy = w / 2.0, h / 2.0
    ds = 15 * scale
    draw.polygon([
        (cx, cy - ds),
        (cx + ds, cy),
        (cx, cy + ds),
        (cx - ds, cy)
    ], fill=color)
    
    img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(filename, "PNG")
    print(f"Created gold divider: {filename}")

def main():
    out_dir = "/Users/sathishveeraragavan/Downloads/Jewellery webapplication for the videos/public/presets"
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Circle Blue Gold Border
    create_circle_gold_border(f"{out_dir}/circle_blue_gold_border.png", bg_color="#0F172A")
    # 2. Circle Green Gold Border
    create_circle_gold_border(f"{out_dir}/circle_green_gold_border.png", bg_color="#064E3B")
    # 3. Circle Red Gold Border
    create_circle_gold_border(f"{out_dir}/circle_red_gold_border.png", bg_color="#701A75")
    
    # 4. Rect Blue Gold Border
    create_rect_gold_border(f"{out_dir}/rect_blue_gold_border.png", bg_color="#0F172A")
    # 5. Rect Green Gold Border
    create_rect_gold_border(f"{out_dir}/rect_green_gold_border.png", bg_color="#064E3B")
    # 6. Rect Maroon Gold Border
    create_rect_gold_border(f"{out_dir}/rect_maroon_gold_border.png", bg_color="#581C87")
    
    # 7. Gold Banner Purity Card
    create_gold_purity_banner(f"{out_dir}/gold_purity_banner.png")
    
    # 8. Gold Divider
    create_elegant_gold_divider(f"{out_dir}/elegant_gold_divider.png")

if __name__ == "__main__":
    main()
